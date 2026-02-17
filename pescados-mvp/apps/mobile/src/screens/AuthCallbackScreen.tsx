import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import Button from '../components/Button';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthCallback'>;

export default function AuthCallbackScreen({ route, navigation }: Props) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // Supabase pode redirecionar com `code` (PKCE) OU com tokens no hash.
        let code = (route.params as any)?.code as string | undefined;
        let access_token = (route.params as any)?.access_token as string | undefined;
        let refresh_token = (route.params as any)?.refresh_token as string | undefined;

        if (!code && (!access_token || !refresh_token)) {
          const url = await Linking.getInitialURL();
          if (url) {
            // Normaliza o hash (#) para query (?) para conseguir ler via URLSearchParams
            const normalized = url.includes('#') ? url.replace('#', '?') : url;
            try {
              const u = new URL(normalized);
              code = u.searchParams.get('code') ?? undefined;
              access_token = u.searchParams.get('access_token') ?? undefined;
              refresh_token = u.searchParams.get('refresh_token') ?? undefined;
            } catch {
              // ignore
            }
          }
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        }

        if (!mounted) return;
        setStatus('success');

        // If session is now active, App.tsx will switch to authenticated stack.
        // If not, the user can just log in with email+senha.
      } catch (e: any) {
        if (!mounted) return;
        setStatus('error');
        setErrorMsg(e?.message ?? 'Falha ao confirmar.');
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [route.params?.code]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ flex: 1, padding: spacing['5'], justifyContent: 'center', gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Confirmando e-mail…</Text>

        {status === 'loading' ? (
          <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Aguarde só um instante.</Text>
        ) : null}

        {status === 'success' ? (
          <>
            <Text style={[textStyle('body'), { color: colors.text.secondary }]}
            >
              E-mail confirmado ✅
            </Text>
            <Button
              title="Continuar"
              onPress={() => {
                // If the user is already logged in, go to main.
                // If not, go to login screen.
                supabase.auth.getSession().then(({ data }) => {
                  if (data.session) navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] as any });
                  else navigation.reset({ index: 0, routes: [{ name: 'Login' }] as any });
                });
              }}
            />
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <Text style={[textStyle('body'), { color: colors.semantic.error }]}
            >
              Não foi possível confirmar.
            </Text>
            <Text style={[textStyle('small'), { color: colors.text.secondary }]}>{errorMsg}</Text>
            <Button
              title="Voltar"
              variant="secondary"
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] as any })}
            />
            <Button
              title="Ajuda"
              variant="ghost"
              onPress={() => Alert.alert('Ajuda', 'Se o erro persistir, peça um novo link de confirmação no Supabase ou tente fazer login novamente.')}
            />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
