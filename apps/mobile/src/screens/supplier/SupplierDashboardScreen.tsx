import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { useSeller } from '../../context/SellerContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, spacing, textStyle } from '../../theme';
import { centsToBRL } from '../../utils';

export default function SupplierDashboardScreen() {
  const navigation = useNavigation<any>();
  const { seller, refresh: refreshSeller } = useSeller();
  const [stats, setStats] = useState({ products: 0, activeProducts: 0, recentOrders: 0, revenue: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!seller) return;

    const [prodRes, ordersRes] = await Promise.all([
      supabase.from('products').select('id, active', { count: 'exact' }).eq('seller_id', seller.id),
      supabase.from('orders').select('id, total_cents, status').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(50),
    ]);

    const products = prodRes.count ?? 0;
    const activeProducts = (prodRes.data ?? []).filter((p: any) => p.active).length;
    const orders = ordersRes.data ?? [];
    const recentOrders = orders.length;
    const revenue = orders.filter((o: any) => o.status === 'paid').reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0);

    setStats({ products, activeProducts, recentOrders, revenue });
  }, [seller]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSeller(), loadStats()]);
    setRefreshing(false);
  }, [refreshSeller, loadStats]);

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja sair da conta de fornecedor?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Entry' }] });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing['4'], gap: spacing['4'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['3'] }}>
          {seller?.logo_url ? (
            <Image source={{ uri: seller.logo_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="storefront" size={28} color="#FFF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={textStyle('h2')}>{seller?.display_name ?? 'Fornecedor'}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>
              {seller?.city ? `${seller.city}/${seller.state}` : 'Painel do fornecedor'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
          <Card style={{ flex: 1, alignItems: 'center', gap: spacing['1'] }}>
            <Text style={[textStyle('h2'), { color: colors.brand.primary }]}>{stats.activeProducts}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Produtos ativos</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', gap: spacing['1'] }}>
            <Text style={[textStyle('h2'), { color: colors.brand.primary }]}>{stats.recentOrders}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Pedidos</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', gap: spacing['1'] }}>
            <Text style={[textStyle('h2'), { color: colors.semantic.success }]}>{centsToBRL(stats.revenue)}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>Receita</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <Card>
          <Text style={[textStyle('bodyStrong'), { marginBottom: spacing['3'] }]}>Ações rápidas</Text>
          <View style={{ gap: spacing['2'] }}>
            <Button title="Novo produto" onPress={() => navigation.navigate('SupplierProductNew')} />
            <Button title="Ver pedidos" variant="secondary" onPress={() => navigation.navigate('SupplierTabs', { screen: 'PedidosTab' })} />
          </View>
        </Card>

        {/* Stripe status */}
        {!seller?.stripe_account_id && (
          <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.semantic.warning }}>
            <Text style={textStyle('bodyStrong')}>Stripe não configurado</Text>
            <Text style={[textStyle('caption'), { color: colors.text.secondary, marginTop: spacing['1'] }]}>
              Configure o Stripe para receber pagamentos dos clientes.
            </Text>
          </Card>
        )}

        <Button title="Sair" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}
