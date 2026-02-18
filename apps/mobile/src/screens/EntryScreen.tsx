import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../App';
import Button from '../components/Button';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Entry'>;

export default function EntryScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.surface }}>
      <View style={{ flex: 1, padding: spacing['6'], justifyContent: 'center', gap: spacing['4'] }}>
        <View style={{ gap: spacing['2'] }}>
          <Text style={textStyle('display')}>LotePro</Text>
          <Text style={[textStyle('body'), { color: colors.text.secondary }]}
          >Marketplace de proteínas • B2B & B2C</Text>
        </View>

        <View style={{ gap: spacing['2'] }}>
          <Button title="Entrar como comprador" onPress={() => navigation.navigate('Login', { role: 'buyer' })} />
          <Button title="Sou fornecedor" variant="secondary" onPress={() => navigation.navigate('SupplierAccess')} />
        </View>

        <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['3'] }]}
        >
          Dica: para fornecedores, a gestão de catálogo e pedidos é via Portal do Fornecedor.
        </Text>
      </View>
    </SafeAreaView>
  );
}
