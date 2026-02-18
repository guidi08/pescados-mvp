import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Input from '../components/Input';
import { colors, spacing, textStyle } from '../theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // signup fields
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
        const redirectTo = Linking.createURL('auth/callback');

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName,
              phone,
              doc_type: docType,
              doc_number: docNumber,
              company_name: docType === 'cnpj' ? fullName : undefined,
            },
          },
        });
        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('already in use')) {
            await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            Alert.alert(
              'E-mail já usado',
              'Este e-mail já foi utilizado. Enviamos um e-mail para recuperação de senha.'
            );
            setMode('login');
            return;
          }
          throw error;
        }

        // If email confirmation is OFF, we might already have a session.
        if (data.session?.user?.id) {
          await supabase
            .from('profiles')
            .update({
              full_name: fullName || null,
              phone: phone || null,
              cpf: docType === 'cpf' ? docNumber : null,
              cnpj: docType === 'cnpj' ? docNumber : null,
              company_name: docType === 'cnpj' ? fullName : null,
              role: 'buyer',
            })
            .eq('id', data.session.user.id);
        }

        Alert.alert(
          'Conta criada',
          'Enviamos um e-mail de confirmação. Ao confirmar, o app deve abrir automaticamente. Depois, faça login com e-mail e senha.'
        );
        setMode('login');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], gap: spacing['3'] }}>
        <Text style={textStyle('display')}>LotePro</Text>
        <Text style={[textStyle('small'), { color: colors.text.secondary }]}
        >
          {mode === 'login' ? 'Acesse sua conta para comprar.' : 'Crie sua conta (CPF ou CNPJ).'}
        </Text>

        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="seu@email.com"
        />

        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {mode === 'signup' && (
          <>
            <Input label="Nome / Razão social" value={fullName} onChangeText={setFullName} placeholder="Seu nome" />

            <View style={{ gap: spacing['2'] }}>
              <Text style={textStyle('label')}>Tipo de cadastro</Text>
              <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                <Button
                  title={docType === 'cpf' ? '✓ CPF' : 'CPF'}
                  onPress={() => setDocType('cpf')}
                  variant={docType === 'cpf' ? 'primary' : 'secondary'}
                  size="sm"
                />
                <Button
                  title={docType === 'cnpj' ? '✓ CNPJ' : 'CNPJ'}
                  onPress={() => setDocType('cnpj')}
                  variant={docType === 'cnpj' ? 'primary' : 'secondary'}
                  size="sm"
                />
              </View>
            </View>

            <Input
              label={docType.toUpperCase()}
              value={docNumber}
              onChangeText={setDocNumber}
              placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00'}
              keyboardType="number-pad"
            />

            <Input
              label="Telefone (recomendado)"
              value={phone}
              onChangeText={setPhone}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
          </>
        )}

        <Button title={loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={onSubmit} disabled={loading} />

        <Button
          title={mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          disabled={loading}
          variant="ghost"
        />

        <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}
        >
          Dica antifraude: mantenha confirmação de e-mail ativa. Para fornecedores, use o Portal do Fornecedor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
