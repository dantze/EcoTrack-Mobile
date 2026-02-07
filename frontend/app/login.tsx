import { StyleSheet, Text, View, TextInput, Pressable, TouchableWithoutFeedback, Keyboard, Alert, ActivityIndicator } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { AuthService } from '../services/AuthService'

const login = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Validate input
    if (!username.trim() || !password.trim()) {
      Alert.alert('Eroare', 'Te rog introdu username și parola.');
      return;
    }

    setLoading(true);

    try {
      const response = await AuthService.login(username.trim().toLowerCase(), password);

      if (response.success) {
        console.log('Login successful:', response.fullName, 'Roles:', response.roles);

        // Redirect based on role
        if (response.roles.includes('DRIVER')) {
          // Drivers go to Driver section
          router.replace('/Driver/WestCenter');
        } else if (response.roles.includes('SALES') || response.roles.includes('TECH')) {
          // Sales and Tech staff go to Sales section (they see the same things)
          router.replace('/Sales/WestCenter');
        } else {
          // Fallback - shouldn't happen but just in case
          Alert.alert('Eroare', 'Rolul utilizatorului nu este recunoscut.');
        }
      } else {
        // Login failed
        Alert.alert('Eroare', response.message || 'Autentificare eșuată.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Eroare', 'Nu s-a putut conecta la server. Verifică conexiunea.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>

        <View style={styles.logoStack}>
          <View style={styles.logoBar} />
          <View style={styles.logoBar} />
          <View style={styles.logoBar} />

          <View style={styles.textOverlay}>
            <Text style={styles.ecoTrack}>EcoTrack</Text>
          </View>
        </View>

        <View style={styles.inputFields}>
          <TextInput
            style={styles.input}
            placeholder='Username'
            placeholderTextColor='#A5A5A5'
            value={username}
            onChangeText={setUsername}
            autoCapitalize='none'
            autoCorrect={false}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder='Password'
            placeholderTextColor='#A5A5A5'
            value={password}
            onChangeText={setPassword}
            autoCapitalize='none'
            autoCorrect={false}
            textContentType='password'
            autoComplete='password'
            secureTextEntry={true}
            editable={!loading}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            pressed && !loading && { opacity: 0.8, transform: [{ scale: 0.99 }] },
            loading && { opacity: 0.6 }
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginText}>Login</Text>
          )}
        </Pressable>
      </View>
    </TouchableWithoutFeedback>
  )
}

export default login

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 100,
    paddingTop: 130,
    backgroundColor: '#16283C'
  },
  logoStack: {
    position: 'relative',
    width: 200,
    height: 152,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  logoBar: {
    width: 150,
    height: 32,
    backgroundColor: '#427992',
    borderRadius: 23,
    transform: [{ rotate: '42deg' }]
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ecoTrack: {
    color: '#FFFFFF',
    fontSize: 36,
    fontStyle: 'italic',
    fontWeight: 'normal'
  },
  inputFields: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: 290,
    height: 120
  },
  input: {
    width: 290,
    height: 50,
    backgroundColor: 'white',
    borderRadius: 14,
    paddingLeft: 10,
    color: '#444c53ff'
  },
  loginButton: {
    position: 'absolute',
    bottom: 270,
    width: 220,
    height: 45,
    backgroundColor: '#427992',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'normal'
  }
})