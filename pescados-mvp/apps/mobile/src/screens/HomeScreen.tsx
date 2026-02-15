import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabaseClient';
import { RootStackParamList } from '../../App';
import { useCart } from '../context/CartContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, textStyle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type Seller = {
  id: string;
  display_name: string;
  city: string | null;
  state: string | null;
  cutoff_time: string;
  active: boolean;
};

export default function HomeScreen({ navigation }: Props) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const { items } = useCart();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sellers')
      .select('id, display_name, city, state, cutoff_time, active')
      .eq('active', true)
      .order('display_name', { ascending: true });

    if (!error) setSellers((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel('realtime-sellers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Fornecedores</Text>

        <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
          <Button title={`Carrinho (${items.length})`} onPress={() => navigation.navigate('Cart')} size="sm" />
          <Button title="Meus pedidos" onPress={() => navigation.navigate('Orders')} size="sm" variant="secondary" />
          <Button title="Sair" onPress={logout} size="sm" variant="ghost" />
        </View>

        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={sellers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Seller', { sellerId: item.id, sellerName: item.display_name })}>
            <Card>
              <Text style={textStyle('h3')}>{item.display_name}</Text>
              <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}
              >
                {item.city ? `${item.city}${item.state ? `/${item.state}` : ''}` : '—'} • Cut-off: {item.cutoff_time}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ padding: spacing['4'], color: colors.text.secondary }}>Nenhum fornecedor ativo.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
