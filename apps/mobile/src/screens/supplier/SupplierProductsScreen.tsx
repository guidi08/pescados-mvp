import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SafeAreaView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import { useSeller } from '../../context/SellerContext';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { colors, radius, spacing, textStyle } from '../../theme';
import { centsToBRL } from '../../utils';

type Product = {
  id: string;
  name: string;
  category: string;
  fresh: boolean;
  active: boolean;
  base_price_cents: number;
  unit: string;
  pricing_mode: string;
};

export default function SupplierProductsScreen() {
  const navigation = useNavigation<any>();
  const { sellerId } = useSeller();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) return;
    const { data } = await supabase
      .from('products')
      .select('id, name, category, fresh, active, base_price_cents, unit, pricing_mode')
      .eq('seller_id', sellerId)
      .order('name');
    setProducts(data ?? []);
  }, [sellerId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!sellerId) return;
    const ch = supabase.channel(`supplier-products-${sellerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${sellerId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function toggleActive(product: Product) {
    await supabase.from('products').update({ active: !product.active }).eq('id', product.id);
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const renderItem = ({ item }: { item: Product }) => (
    <Pressable
      onPress={() => navigation.navigate('SupplierProductDetail', { productId: item.id })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing['3'],
        backgroundColor: pressed ? colors.neutral[50] : colors.background.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing['3'],
      })}
    >
      <View style={{ flex: 1, gap: spacing['1'] }}>
        <Text style={textStyle('bodyStrong')}>{item.name}</Text>
        <View style={{ flexDirection: 'row', gap: spacing['2'], alignItems: 'center' }}>
          <Badge label={item.fresh ? 'Fresco' : 'Congelado'} variant={item.fresh ? 'fresh' : 'frozen'} />
          <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>{item.category}</Text>
        </View>
        <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
          {centsToBRL(item.base_price_cents)}/{item.unit}
          {item.pricing_mode === 'per_kg_box' ? ' (peso variável)' : ''}
        </Text>
      </View>
      <Switch
        value={item.active}
        onValueChange={() => toggleActive(item)}
        trackColor={{ true: colors.brand.primary, false: colors.neutral[200] }}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'], gap: spacing['3'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={textStyle('h2')}>Produtos</Text>
          <Button title="+ Novo" size="sm" onPress={() => navigation.navigate('SupplierProductNew')} />
        </View>
        <Input label="" value={search} onChangeText={setSearch} placeholder="Buscar produto..." />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
        ListEmptyComponent={
          <View style={{ padding: spacing['6'], alignItems: 'center' }}>
            <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Nenhum produto cadastrado</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
