import {
    ActivityIndicator,
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthService, AuthSession } from '../services/AuthService';
import { EnrollmentService, EnrollmentStatus } from '../services/EnrollmentService';
import { PendingTicket } from '../services/enrollmentStorage';
import { destinationForRoles, roleLabel } from '../services/roleRouting';
import { AppColors } from '../constants/Colors';

/**
 * The app's one public screen — and the only way in.
 *
 * There is no username and no password: `/api/auth/login` was deleted from the
 * backend. This device asks an admin for access, shows a six-digit code, and
 * waits. The admin checks the code against what the person in front of them
 * reads out, picks a role, and approves; this screen polls until it can
 * exchange its one-time secret for tokens.
 *
 * Three states, in order (same as web's `EnrollmentPage`):
 *   form     → name (+ the first-run setup code, only on a fresh instance)
 *   waiting  → the six-digit code, a countdown, polling
 *   done     → "Sunteți înregistrat cu rol de X", then into the app
 *
 * The pending ticket is persisted (`services/enrollmentStorage.ts`), so
 * backgrounding the app — or Android killing it — while an admin walks over
 * does not force the user to start again with a different code.
 */

/** How often to ask whether an admin has decided yet. */
const POLL_INTERVAL_MS = 3000;

/** Long enough to actually read which role you were given. */
const CONFIRMATION_MS = 1800;

type Phase = 'loading' | 'form' | 'waiting' | 'done';

/** What the admin sees in the request queue. Never used as a credential. */
const deviceLabel = `EcoTrack ${Platform.OS} ${String(Platform.Version)}`;

const formatCountdown = (remainingMs: number): string => {
    const total = Math.max(0, Math.floor(remainingMs / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const Enrollment = () => {
    const router = useRouter();

    const [phase, setPhase] = useState<Phase>('loading');
    const [fullName, setFullName] = useState('');
    const [setupCode, setSetupCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [serverStatus, setServerStatus] = useState<EnrollmentStatus | null>(null);
    const [ticket, setTicket] = useState<PendingTicket | null>(null);
    const [grantedRole, setGrantedRole] = useState<string | null>(null);
    const [remainingMs, setRemainingMs] = useState<number | null>(null);

    // The "read the confirmation, then navigate" timer. Held in a ref purely so
    // it can be cancelled if the screen goes away first — an Expo timer that
    // outlives its screen still fires, and would navigate out from under
    // whatever the user opened instead.
    const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
        },
        [],
    );

    // ------------------------------------------------------------- boot

    useEffect(() => {
        let active = true;

        // Only decides whether to render the setup-code field. A server that is
        // unreachable must not block the form: the request itself will report
        // the real problem.
        EnrollmentService.getStatus()
            .then((status) => {
                if (active) setServerStatus(status);
            })
            .catch(() => {
                if (active) setServerStatus(null);
            });

        EnrollmentService.getPendingTicket()
            .then((pending) => {
                if (!active) return;
                setTicket(pending);
                setPhase(pending ? 'waiting' : 'form');
            })
            .catch(() => {
                if (active) setPhase('form');
            });

        return () => {
            active = false;
        };
    }, []);

    // ------------------------------------------------- terminal transitions

    /** Every dead end lands here: forget the request and show the form again. */
    const startOver = useCallback(async (message: string | null) => {
        await EnrollmentService.cancelPendingRequest();
        setTicket(null);
        setRemainingMs(null);
        setPhase('form');
        setError(message);
    }, []);

    const onIssued = useCallback(
        (session: AuthSession) => {
            setGrantedRole(session.user.roles[0] ?? null);
            setError(null);
            setPhase('done');

            confirmationTimer.current = setTimeout(() => {
                const destination = destinationForRoles(session.user.roles);
                if (destination.kind === 'screen') {
                    router.replace(destination.path as never);
                } else if (destination.kind === 'roleSelection') {
                    router.replace({
                        pathname: '/RoleSelection',
                        params: {
                            roles: destination.roles.join(','),
                            fullName: session.user.fullName,
                        },
                    });
                } else if (destination.kind === 'office') {
                    // Approved as SALES or TECH: a correct approval for an app
                    // that no longer has those screens (TODO-33). The session
                    // is good and is kept — office staff use the web app, and
                    // the signpost says so.
                    router.replace({
                        pathname: '/office',
                        params: {
                            roles: destination.roles.join(','),
                            fullName: session.user.fullName,
                        },
                    });
                } else {
                    // Approved into a role this app has no screens for. Holding a
                    // session that can open nothing is worse than none, so drop it.
                    void AuthService.forgetSession();
                    setPhase('form');
                    setError(destination.message);
                }
            }, CONFIRMATION_MS);
        },
        [router],
    );

    // ---------------------------------------------------------- polling

    useEffect(() => {
        if (phase !== 'waiting' || !ticket) return;

        // `cancelled` covers the gap the timer cannot: a claim already in flight
        // when the screen unmounts still resolves, and must not act on it.
        let cancelled = false;
        let inFlight = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        const stop = () => {
            cancelled = true;
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };

        const tick = async () => {
            if (cancelled || inFlight) return;
            inFlight = true;
            try {
                const result = await EnrollmentService.claim(ticket);
                if (cancelled) return;
                if (result.state === 'issued') {
                    stop();
                    onIssued(result.session);
                } else if (result.state !== 'pending') {
                    // rejected · expired · unknown — all terminal.
                    stop();
                    await startOver(result.message);
                }
                // 'pending' → keep waiting.
            } catch {
                // A transient network failure must not end the wait; the next
                // tick retries. Losing the code here would mean walking back to
                // the admin with a different one.
            } finally {
                inFlight = false;
            }
        };

        // Ask once immediately: a bootstrap request (`autoApproved`) is already
        // approved, so this first call issues tokens with no waiting at all.
        void tick();
        timer = setInterval(() => void tick(), POLL_INTERVAL_MS);

        return stop;
    }, [phase, ticket, onIssued, startOver]);

    // -------------------------------------------------------- countdown

    // Bails out without touching state: `remainingMs` is only ever read while
    // waiting, and every path INTO waiting clears it first. Clearing it here
    // instead would be a setState in an effect body, for nothing.
    useEffect(() => {
        if (phase !== 'waiting' || !ticket?.expiresAt) return;
        const deadline = Date.parse(ticket.expiresAt);
        if (Number.isNaN(deadline)) return;

        let timer: ReturnType<typeof setInterval> | null = null;
        const stop = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };

        const update = () => {
            const remaining = deadline - Date.now();
            setRemainingMs(Math.max(0, remaining));
            if (remaining <= 0) {
                // The server would answer 410 on the next poll anyway; saying so
                // on the exact second keeps the screen honest instead of leaving
                // "0:00" spinning for up to another poll interval.
                stop();
                void startOver('Cererea a expirat. Trimite o cerere nouă.');
            }
        };

        // Interval first, then the immediate tick: a ticket restored after it
        // already expired must be able to stop a timer that exists.
        timer = setInterval(update, 1000);
        update();
        return stop;
    }, [phase, ticket, startOver]);

    // ----------------------------------------------------------- submit

    const handleRequest = async () => {
        Keyboard.dismiss();
        setSubmitting(true);
        setError(null);
        try {
            const result = await EnrollmentService.requestAccess({
                fullName,
                deviceLabel,
                setupCode,
            });
            if (result.state === 'error') {
                setError(result.message);
                return;
            }
            setSetupCode('');
            setRemainingMs(null);
            setTicket(result.ticket);
            setPhase('waiting');
        } catch (requestError) {
            console.error('Enrollment request failed:', requestError);
            setError('Nu s-a putut conecta la server. Verifică conexiunea.');
        } finally {
            setSubmitting(false);
        }
    };

    // ------------------------------------------------------------ render

    const logo = (
        <View style={styles.logoStack}>
            <View style={styles.logoBar} />
            <View style={styles.logoBar} />
            <View style={styles.logoBar} />
            <View style={styles.textOverlay}>
                <Text style={styles.ecoTrack}>EcoTrack</Text>
            </View>
        </View>
    );

    if (phase === 'loading') {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
            </View>
        );
    }

    if (phase === 'done') {
        return (
            <View style={[styles.container, styles.centered]}>
                {logo}
                <Text style={styles.doneText}>
                    Sunteți înregistrat cu rol de {roleLabel(grantedRole)}
                </Text>
            </View>
        );
    }

    if (phase === 'waiting' && ticket) {
        return (
            <View style={styles.container}>
                {logo}
                <Text style={styles.hint}>
                    Spune acest cod administratorului. El îl va verifica înainte să aprobe.
                </Text>
                <Text style={styles.code}>{ticket.verificationCode}</Text>
                <View style={styles.waitingRow}>
                    <ActivityIndicator color={AppColors.textWhite} />
                    <Text style={styles.waitingText}>
                        Se așteaptă aprobarea
                        {remainingMs !== null ? ` · expiră în ${formatCountdown(remainingMs)}` : ''}
                    </Text>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable style={styles.cancelButton} onPress={() => void startOver(null)}>
                    <Text style={styles.cancelText}>Anulează</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
                {logo}

                <Text style={styles.hint}>
                    {serverStatus?.awaitingBootstrap
                        ? 'Nicio persoană nu are încă acces. Prima cerere devine administrator.'
                        : serverStatus?.adminLockout
                          ? 'Niciun administrator nu mai este conectat, deci nimeni nu poate aproba cereri. Cu codul de recuperare din jurnalul serverului poți crea un administrator nou.'
                          : 'Trimite o cerere de acces. Un administrator o va aproba.'}
                </Text>

                <View style={styles.inputFields}>
                    <TextInput
                        style={styles.input}
                        placeholder="Nume complet"
                        placeholderTextColor={AppColors.placeholderText}
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        editable={!submitting}
                    />
                    {/* One field, two states - first run and admin lockout
                        (TODO-30). Only the placeholder tells them apart. */}
                    {serverStatus?.setupCodeRequired ? (
                        <TextInput
                            style={styles.input}
                            placeholder={
                                serverStatus.adminLockout
                                    ? 'Cod de recuperare'
                                    : 'Cod de configurare'
                            }
                            placeholderTextColor={AppColors.placeholderText}
                            value={setupCode}
                            onChangeText={setSetupCode}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!submitting}
                        />
                    ) : null}
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                    style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && !submitting && { opacity: 0.8, transform: [{ scale: 0.99 }] },
                        submitting && { opacity: 0.6 },
                    ]}
                    onPress={() => void handleRequest()}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color={AppColors.textWhite} />
                    ) : (
                        <Text style={styles.primaryText}>Solicită acces</Text>
                    )}
                </Pressable>
            </View>
        </TouchableWithoutFeedback>
    );
};

export default Enrollment;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 28,
        paddingTop: 120,
        paddingHorizontal: 30,
        backgroundColor: AppColors.screenBackground,
    },
    centered: {
        justifyContent: 'center',
        paddingTop: 0,
    },
    logoStack: {
        position: 'relative',
        width: 200,
        height: 152,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
        marginBottom: 20,
    },
    logoBar: {
        width: 150,
        height: 32,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 23,
        transform: [{ rotate: '42deg' }],
    },
    textOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ecoTrack: {
        color: AppColors.textWhite,
        fontSize: 36,
        fontStyle: 'italic',
    },
    hint: {
        color: AppColors.subtitleText,
        fontSize: 15,
        textAlign: 'center',
    },
    inputFields: {
        width: '100%',
        gap: 14,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: 'white',
        borderRadius: 14,
        paddingLeft: 12,
        color: '#444c53',
    },
    primaryButton: {
        width: 220,
        height: 45,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: {
        color: AppColors.textWhite,
        fontSize: 20,
    },
    code: {
        color: AppColors.textWhite,
        fontSize: 46,
        letterSpacing: 10,
        fontVariant: ['tabular-nums'],
    },
    waitingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    waitingText: {
        color: AppColors.subtitleText,
        fontSize: 15,
    },
    error: {
        color: AppColors.errorRed,
        fontSize: 14,
        textAlign: 'center',
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    cancelText: {
        color: AppColors.mutedText,
        fontSize: 16,
    },
    doneText: {
        color: AppColors.textWhite,
        fontSize: 22,
        textAlign: 'center',
        marginTop: 10,
    },
});
