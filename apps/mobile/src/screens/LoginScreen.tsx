import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import Input from '../components/Input';
import { colors, spacing, textStyle } from '../theme';
import { formatCPF, formatCNPJ, formatPhone, isValidCPF, isValidCNPJ } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // signup fields
  const [fullName, setFullName] = useState('');
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cpf');
  const [docNumber, setDocNumber] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  function switchMode() {
    const next = mode === 'login' ? 'signup' : 'login';
    setMode(next);
    // Clear signup-only fields when switching modes
    if (next === 'login') {
      setFullName('');
      setDocType('cpf');
      setDocNumber('');
      setPhone('');
    }
  }

  function handleDocNumberChange(value: string) {
    if (docType === 'cpf') {
      setDocNumber(formatCPF(value));
    } else {
      setDocNumber(formatCNPJ(value));
    }
  }

  function handleDocTypeSwitch(next: 'cpf' | 'cnpj') {
    if (next === docType) return;
    setDocType(next);
    setDocNumber(''); // Clear doc number when switching types
  }

  async function onSubmit() {
    // Basic validation
    if (!email.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o e-mail.');
      return;
    }
    if (!password) {
      Alert.alert('Campo obrigatório', 'Preencha a senha.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 6) {
        Alert.alert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      const rawDoc = docNumber.replace(/\D/g, '');
      if (rawDoc) {
        if (docType === 'cpf' && !isValidCPF(rawDoc)) {
          Alert.alert('CPF inválido', 'Verifique o CPF digitado.');
          return;
        }
        if (docType === 'cnpj' && !isValidCNPJ(rawDoc)) {
          Alert.alert('CNPJ inválido', 'Verifique o CNPJ digitado.');
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        const redirectTo = (process.env.EXPO_PUBLIC_EMAIL_REDIRECT_URL?.trim() || Linking.createURL('auth/callback'));
        const rawDoc = docNumber.replace(/\D/g, '');

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName,
              phone: phone.replace(/\D/g, ''),
              doc_type: docType,
              doc_number: rawDoc,
              company_name: docType === 'cnpj' ? fullName : undefined,
            },
          },
        });
        if (error) throw error;

        // If email confirmation is OFF, we might already have a session.
        if (data.session?.user?.id) {
          await supabase
            .from('profiles')
            .update({
              full_name: fullName || null,
              phone: phone.replace(/\D/g, '') || null,
              cpf: docType === 'cpf' ? rawDoc : null,
              cnpj: docType === 'cnpj' ? rawDoc : null,
              company_name: docType === 'cnpj' ? fullName : null,
              role: 'buyer',
            })
            .eq('id', data.session.user.id);
        }

        Alert.alert(
          'Conta criada',
          'Enviamos um e-mail de confirmação. Ao confirmar, o app deve abrir automaticamente. Depois, faça login com e-mail e senha.'
        );
        switchMode(); // Switch back to login mode
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['5'], gap: spacing['3'] }} keyboardShouldPersistTaps="handled">
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
                  onPress={() => handleDocTypeSwitch('cpf')}
                  variant={docType === 'cpf' ? 'primary' : 'secondary'}
                  size="sm"
                />
                <Button
                  title={docType === 'cnpj' ? '✓ CNPJ' : 'CNPJ'}
                  onPress={() => handleDocTypeSwitch('cnpj')}
                  variant={docType === 'cnpj' ? 'primary' : 'secondary'}
                  size="sm"
                />
              </View>
            </View>

            <Input
              label={docType.toUpperCase()}
              value={docNumber}
              onChangeText={handleDocNumberChange}
              placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00'}
              keyboardType="number-pad"
            />

            <Input
              label="Telefone (recomendado)"
              value={phone}
              onChangeText={(v) => setPhone(formatPhone(v))}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />
          </>
        )}

        <Button title={loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={onSubmit} disabled={loading} />

        <Button
          title={mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          onPress={switchMode}
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
