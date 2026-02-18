import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../supabaseClient';
import { useBuyer } from '../context/BuyerContext';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';

type Seller = {
  id: string;
  display_name: string;
  city: string;
  state: string;
  active: boolean;
  cutoff_time: string;
  min_order_cents: number;
  shipping_fee_cents: number;
  b2c_enabled: boolean;
  logo_url?: string | null;
};

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { channel } = useBuyer();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from('sellers')
      .select('id, display_name, city, state, active, cutoff_time, min_order_cents, shipping_fee_cents, b2c_enabled, logo_url')
      .eq('active', true)
      .order('display_name', { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as Seller[];
      setSellers(channel === 'b2c' ? list.filter((s) => s.b2c_enabled) : list);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const channelRealtime = supabase
      .channel('realtime-sellers-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channelRealtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s) => `${s.display_name} ${s.city} ${s.state}`.toLowerCase().includes(q));
  }, [sellers, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>Fornecedores</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar fornecedor"
          placeholderTextColor={colors.text.tertiary}
          style={{
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: colors.background.surface,
            color: colors.text.primary,
          }}
        />

        {loading ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text> : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'], paddingBottom: 120 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Seller', { sellerId: item.id, sellerName: item.display_name })}>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.background.surface,
                    borderWidth: 1,
                    borderColor: colors.border.subtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {item.logo_url ? (
                    <Image source={{ uri: item.logo_url }} style={{ width: 48, height: 48 }} resizeMode="cover" />
                  ) : (
                    <Text style={textStyle('bodyStrong')}>L</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: spacing['3'] }}>
                      <Text style={textStyle('h3')}>{item.display_name}</Text>
                      <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['1'] }]}
                      >
                        {item.city}/{item.state}
                      </Text>
                    </View>
                    <Badge label={channel === 'b2b' ? 'B2B' : 'B2C'} variant={channel === 'b2b' ? 'b2b' : 'b2c'} />
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] }}>
                    <Badge label={`Cut-off: ${item.cutoff_time}`} variant="variable" />
                    {item.min_order_cents ? <Badge label={`Mín.: ${centsToBRL(item.min_order_cents)}`} variant="variable" /> : null}
                    <Badge
                      label={item.shipping_fee_cents ? `Frete: ${centsToBRL(item.shipping_fee_cents)}` : 'Frete: grátis'}
                      variant="neutral"
                    />
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={{ padding: spacing['4'], color: colors.text.secondary }}>Nenhum fornecedor disponível.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}
