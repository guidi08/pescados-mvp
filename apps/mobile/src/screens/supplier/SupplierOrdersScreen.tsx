import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import { useSeller } from '../../context/SellerContext';
import Badge from '../../components/Badge';
import { colors, spacing, textStyle } from '../../theme';
import { centsToBRL } from '../../utils';

type Order = {
  id: string;
  created_at: string;
  delivery_date: string | null;
  buyer_channel: 'b2b' | 'b2c';
  status: string;
  payment_status: string;
  total_cents: number;
  contains_fresh: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Aguardando pgto',
  paid: 'Pago',
  processing: 'Processando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

export default function SupplierOrdersScreen() {
  const navigation = useNavigation<any>();
  const { sellerId } = useSeller();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) return;
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, delivery_date, buyer_channel, status, payment_status, total_cents, contains_fresh')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders(data ?? []);
  }, [sellerId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!sellerId) return;
    const ch = supabase.channel(`supplier-orders-${sellerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch { return iso; }
  };

  const renderItem = ({ item }: { item: Order }) => (
    <Pressable
      onPress={() => navigation.navigate('SupplierOrderDetail', { orderId: item.id })}
      style={({ pressed }) => ({
        padding: spacing['3'],
        backgroundColor: pressed ? colors.neutral[50] : colors.background.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={textStyle('bodyStrong')}>#{item.id.slice(0, 8)}</Text>
        <Text style={[textStyle('bodyStrong'), { color: colors.brand.primary }]}>{centsToBRL(item.total_cents)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing['2'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
        <Badge label={item.buyer_channel.toUpperCase()} variant={item.buyer_channel === 'b2b' ? 'b2b' : 'b2c'} />
        <Badge label={STATUS_LABEL[item.status] ?? item.status} variant={item.status === 'paid' ? 'fresh' : item.status === 'canceled' ? 'frozen' : 'neutral'} />
        {item.contains_fresh && <Badge label="Fresco" variant="fresh" />}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'] }}>
        <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
          Criado: {formatDate(item.created_at)}
        </Text>
        {item.delivery_date && (
          <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
            Entrega: {formatDate(item.delivery_date)}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <View style={{ padding: spacing['4'] }}>
        <Text style={textStyle('h2')}>Pedidos</Text>
      </View>
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
        ListEmptyComponent={
          <View style={{ padding: spacing['6'], alignItems: 'center' }}>
            <Text style={[textStyle('body'), { color: colors.text.secondary }]}>Nenhum pedido ainda</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
