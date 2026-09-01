import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The glue between ML Kit and the parser (TODO-13).
 *
 * `utils/mrz.test.ts` proves the parsing against the shared fixture. What is
 * worth pinning here is the shape adaptation, which is where a recogniser
 * integration actually goes wrong: ML Kit returns text twice, once joined and
 * once per block, and a card photographed at an angle can land the three MRZ
 * rows in three separate blocks. Reading only one of the two loses those.
 *
 * The native module is replaced with a `vi.mock` FACTORY so the real one is
 * never loaded — it imports `react-native`, which this Node-environment config
 * has no transform for. See vitest.config.ts.
 */

const recognize = vi.fn();

vi.mock('@react-native-ml-kit/text-recognition', () => ({
    default: { recognize: (...args: any[]) => recognize(...args) },
}));

import { ID_SCAN_REFUSALS, isIdScanAvailable, scanIdImage } from '../IdScanService';

const GOOD = [
    'IDROUZC123456<21800101401237<<',
    '8001014M3001019ROU<<<<<<<<<<<4',
    'POPESCU<<ION<ANDREI<<<<<<<<<<<',
];

/** ML Kit's shape: one joined string plus the same text split into blocks. */
const result = (text: string, blocks: string[][] = []) => ({
    text,
    blocks: blocks.map((linesOfBlock) => ({ lines: linesOfBlock.map((line) => ({ text: line })) })),
});

beforeEach(() => {
    recognize.mockReset();
});

describe('scanIdImage', () => {
    it('reads the MRZ out of the joined text', async () => {
        recognize.mockResolvedValue(result(GOOD.join('\n')));

        const scan = await scanIdImage('file:///tmp/buletin.jpg');

        expect(scan).toEqual({
            ok: true,
            read: {
                fullName: 'Popescu Ion Andrei',
                cnp: '1800101401237',
                sex: 'M',
                birthDate: '1980-01-01',
            },
        });
        expect(recognize).toHaveBeenCalledWith('file:///tmp/buletin.jpg');
    });

    /**
     * The reason both sources are collected. Here the joined text interleaves
     * the card's printed fields between the MRZ rows, so the triple is only
     * adjacent inside the blocks.
     */
    it('still finds the MRZ when the rows land in separate blocks', async () => {
        recognize.mockResolvedValue(
            result(
                ['ROMANIA', GOOD[0], 'CARTE DE IDENTITATE', GOOD[1], 'SERIA ZC', GOOD[2]].join('\n'),
                [[GOOD[0]], [GOOD[1]], [GOOD[2]]],
            ),
        );

        const scan = await scanIdImage('file:///tmp/buletin.jpg');

        expect(scan.ok).toBe(true);
    });

    it('reports a refusal rather than throwing when the photo is unreadable', async () => {
        recognize.mockResolvedValue(result('ROMANIA\nCARTE DE IDENTITATE'));

        await expect(scanIdImage('file:///tmp/blurry.jpg')).resolves.toEqual({
            ok: false,
            reason: 'format',
        });
    });

    it('does not accept a card that contradicts itself', async () => {
        // Valid CNP, valid check digits, but it claims a different birth day
        // than MRZ line 2 — the cross-check is the only thing that sees it.
        recognize.mockResolvedValue(
            result(
                [
                    'IDROUZC123456<21800102401231<<',
                    '8001014M3001019ROU<<<<<<<<<<<9',
                    'POPESCU<<ION<ANDREI<<<<<<<<<<<',
                ].join('\n'),
            ),
        );

        await expect(scanIdImage('file:///tmp/x.jpg')).resolves.toEqual({
            ok: false,
            reason: 'cnp-mismatch',
        });
    });

    it('never uploads the image — the recogniser is the only thing it is given to', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        recognize.mockResolvedValue(result(GOOD.join('\n')));

        await scanIdImage('file:///tmp/buletin.jpg');

        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});

describe('isIdScanAvailable', () => {
    it('is true when the native module is linked', () => {
        expect(isIdScanAvailable()).toBe(true);
    });
});

describe('ID_SCAN_REFUSALS', () => {
    it('has a message for every rejection reason the parser can produce', () => {
        expect(Object.keys(ID_SCAN_REFUSALS).sort()).toEqual([
            'check-digit',
            'cnp-invalid',
            'cnp-mismatch',
            'format',
        ]);
    });

    /**
     * The distinction the operator acts on: a bad photo is worth retaking, a
     * self-contradictory card is not.
     */
    it('tells the operator to retake for a read failure and to type for a data failure', () => {
        expect(ID_SCAN_REFUSALS.format).toMatch(/Fotografiați/);
        expect(ID_SCAN_REFUSALS['check-digit']).toMatch(/fotografie mai clară/);
        expect(ID_SCAN_REFUSALS['cnp-invalid']).toMatch(/manual/);
        expect(ID_SCAN_REFUSALS['cnp-mismatch']).toMatch(/manual/);
    });
});
