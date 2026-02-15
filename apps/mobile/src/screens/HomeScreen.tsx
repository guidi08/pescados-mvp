import React, { useEffect, useState } from 'react';
import { Button, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../supabaseClient';
import { RootStackParamList } from '../../App';
import { useCart } from '../context/CartContext';

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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Fornecedores</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={`Carrinho (${items.length})`} onPress={() => navigation.navigate('Cart')} />
          <Button title="Meus pedidos" onPress={() => navigation.navigate('Orders')} />
          <Button title="Sair" onPress={logout} />
        </View>

        {loading ? <Text>Carregando...</Text> : null}
      </View>

      <FlatList
        data={sellers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Seller', { sellerId: item.id, sellerName: item.display_name })}
            style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.display_name}</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              {item.city ? `${item.city}${item.state ? `/${item.state}` : ''}` : '—'} • Cut-off: {item.cutoff_time}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={{ padding: 16, color: '#666' }}>Nenhum fornecedor ativo.</Text> : null}
      />
    </SafeAreaView>
  );
}
