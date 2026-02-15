import React, { useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabaseClient';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // extra fields for signup (MVP simples)
  const [fullName, setFullName] = useState('');
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cpf');
  const [docNumber, setDocNumber] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // If session exists (email confirmation OFF), update profile
        const userId = data.user?.id;
        if (userId) {
          await supabase.from('profiles').update({
            full_name: fullName || null,
            phone: phone || null,
            cpf: docType === 'cpf' ? docNumber : null,
            cnpj: docType === 'cnpj' ? docNumber : null,
            role: 'buyer',
          }).eq('id', userId);
        }

        Alert.alert('Conta criada', 'Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.');
        setMode('login');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>Pescados Marketplace</Text>
        <Text style={{ color: '#555' }}>
          {mode === 'login' ? 'Acesse sua conta para comprar.' : 'Crie sua conta (CPF ou CNPJ).'}
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '600' }}>E-mail</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="seu@email.com"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '600' }}>Senha</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
          />
        </View>

        {mode === 'signup' && (
          <>
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '600' }}>Nome / Razão social</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Seu nome"
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '600' }}>Tipo de cadastro</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title={docType === 'cpf' ? '✓ CPF' : 'CPF'} onPress={() => setDocType('cpf')} />
                <Button title={docType === 'cnpj' ? '✓ CNPJ' : 'CNPJ'} onPress={() => setDocType('cnpj')} />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '600' }}>{docType.toUpperCase()}</Text>
              <TextInput
                value={docNumber}
                onChangeText={setDocNumber}
                placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '600' }}>Telefone (recomendado)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
              />
            </View>
          </>
        )}

        <Button title={loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={onSubmit} disabled={loading} />

        <Button
          title={mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          disabled={loading}
        />

        <Text style={{ color: '#777', fontSize: 12, marginTop: 8 }}>
          Dica antifraude: ative confirmação de e-mail e, se possível, validação por SMS no Supabase.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
