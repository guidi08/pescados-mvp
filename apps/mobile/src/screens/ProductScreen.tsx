import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { colors, spacing, textStyle } from '../theme';
import { centsToBRL } from '../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  fresh: boolean;
  tags: string[] | null;
  min_expiry_date: string | null;
  base_price_cents: number;
  unit: string;
  active: boolean;
  pricing_mode: 'per_unit' | 'per_kg_box';
  estimated_box_weight_kg: number | null;
  max_weight_variation_pct: number | null;
  sellers?: { display_name: string } | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  price_cents: number;
  active: boolean;
  min_expiry_date: string | null;
};

export default function ProductScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [loadError, setLoadError] = useState<string | null>(null);

  const { addItem, sellerId: currentCartSellerId, sellerName: currentCartSellerName, items: cartItems } = useCart();

  async function load() {
    setLoadError(null);
    const { data: p, error: pErr } = await supabase
      .from('products')
      .select('*, sellers(display_name)')
      .eq('id', productId)
      .single();

    if (pErr) {
      setLoadError(pErr.message);
      return;
    }
    setProduct(p as any);

    const { data: v } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const activeVariants = ((v ?? []) as any as Variant[]).filter((x) => x.active);
    setVariants(activeVariants);
    if (activeVariants.length) setSelectedVariantId(activeVariants[0].id);
    else setSelectedVariantId(null);
  }

  useEffect(() => {
    load();
    // Unique channel per product to avoid collisions
    const channelName = `realtime-product-${productId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${productId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [productId]);

  const selectedVariant = useMemo(() => variants.find((v) => v.id === selectedVariantId) ?? null, [variants, selectedVariantId]);
  const unitPriceCents = selectedVariant ? selectedVariant.price_cents : (product?.base_price_cents ?? 0);
  const minExpiry = selectedVariant?.min_expiry_date ?? product?.min_expiry_date ?? null;
  const pricingMode = product?.pricing_mode ?? 'per_unit';
  const priceUnitLabel = pricingMode === 'per_kg_box' ? 'kg' : (product?.unit ?? 'un');
  const estimatedBoxWeightKg = product?.estimated_box_weight_kg ?? null;
  const maxVarPct = product?.max_weight_variation_pct ?? null;

  function parseQuantity(): number {
    return Number(quantity.replace(',', '.'));
  }

  function onAddToCart() {
    if (!product) return;
    if (!product.active) { Alert.alert('Indispon\u00edvel', 'Este produto est\u00e1 pausado.'); return; }

    const q = parseQuantity();
    if (!Number.isFinite(q) || q <= 0) { Alert.alert('Quantidade inv\u00e1lida', 'Informe uma quantidade v\u00e1lida maior que zero.'); return; }
    if (pricingMode === 'per_kg_box' && !Number.isInteger(q)) { Alert.alert('Quantidade inv\u00e1lida', 'Para produtos por caixa, a quantidade deve ser um n\u00famero inteiro.'); return; }

    const sellerName = (product as any).sellers?.display_name ?? 'Fornecedor';
    const item = {
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      productName: product.name,
      variantName: selectedVariant?.name ?? null,
      unit: product.unit,
      pricingMode,
      unitPriceCents,
      quantity: q,
      estimatedBoxWeightKg: pricingMode === 'per_kg_box' ? estimatedBoxWeightKg : null,
      maxWeightVariationPct: pricingMode === 'per_kg_box' ? maxVarPct : null,
    };

    // Confirm seller change
    if (currentCartSellerId && currentCartSellerId !== product.seller_id && cartItems.length > 0) {
      Alert.alert(
        'Trocar fornecedor?',
        `Seu carrinho tem itens de "${currentCartSellerName}". Ao adicionar este item, o carrinho anterior ser\u00e1 substitu\u00eddo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Trocar e adicionar', onPress: () => { addItem(product.seller_id, sellerName, item); Alert.alert('Adicionado', 'Item adicionado ao carrinho.'); } },
        ]
      );
      return;
    }

    addItem(product.seller_id, sellerName, item);
    Alert.alert('Adicionado', 'Item adicionado ao carrinho.');
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, padding: spacing['4'], backgroundColor: colors.background.app }}>
        <Text style={[textStyle('body'), { color: colors.semantic.error }]}>Erro ao carregar: {loadError}</Text>
        <Button title="Tentar novamente" onPress={load} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, padding: spacing['4'], backgroundColor: colors.background.app }}>
        <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  const qPreview = parseQuantity();
  const estimatedTotalCents = pricingMode === 'per_unit'
    ? Math.round(unitPriceCents * (Number.isFinite(qPreview) ? qPreview : 0))
    : Math.round(unitPriceCents * (Number(estimatedBoxWeightKg ?? 0) * (Number.isFinite(qPreview) ? qPreview : 0)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.app }}>
      <ScrollView contentContainerStyle={{ padding: spacing['4'], gap: spacing['3'] }}>
        <Text style={textStyle('h1')}>{product.name}</Text>
        <Text style={[textStyle('small'), { color: colors.text.secondary }]}>
          {(product as any).sellers?.display_name ? `Fornecedor: ${(product as any).sellers.display_name}` : ''}
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap' }}>
          <Badge label={product.fresh ? 'Fresco' : 'Congelado'} variant={product.fresh ? 'fresh' : 'frozen'} />
          {pricingMode === 'per_kg_box' ? <Badge label="Peso vari\u00e1vel" variant="variable" /> : null}
          {product.tags?.length ? <Badge label={product.tags.join(' - ')} variant="variable" /> : null}
        </View>

        {minExpiry ? <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Validade m\u00ednima: {minExpiry}</Text> : null}
        {product.description ? <Text style={[textStyle('body'), { color: colors.text.primary }]}>{product.description}</Text> : null}

        {pricingMode === 'per_kg_box' ? (
          <Card>
            <Text style={textStyle('h3')}>Produto por caixa (peso vari\u00e1vel)</Text>
            <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>Pre\u00e7o \u00e9 por kg. Voc\u00ea compra por caixa.</Text>
            <Text style={[textStyle('small'), { color: colors.text.secondary, marginTop: spacing['2'] }]}>Peso estimado: {estimatedBoxWeightKg ?? '\u2014'} kg/caixa{maxVarPct ? ` - varia\u00e7\u00e3o m\u00e1x.: ${maxVarPct}%` : ''}</Text>
            <Text style={[textStyle('caption'), { color: colors.text.tertiary, marginTop: spacing['2'] }]}>O valor final pode variar. Em B2B, o ajuste pode gerar credito/debito no saldo do cliente.</Text>
          </Card>
        ) : null}

        {variants.length ? (
          <View style={{ gap: spacing['2'] }}>
            <Text style={textStyle('label')}>Escolha o calibre/tamanho</Text>
            <View style={{ gap: spacing['2'] }}>
              {variants.map((v) => (
                <Button key={v.id} title={`${selectedVariantId === v.id ? '✓ ' : ''}${v.name} — ${centsToBRL(v.price_cents)}/${priceUnitLabel}`} onPress={() => setSelectedVariantId(v.id)} variant={selectedVariantId === v.id ? 'primary' : 'secondary'} />
              ))}
            </View>
          </View>
        ) : (
          <Text style={textStyle('h2')}>{centsToBRL(product.base_price_cents)} / {priceUnitLabel}</Text>
        )}

        <View style={{ gap: spacing['2'] }}>
          <Text style={textStyle('label')}>Quantidade ({pricingMode === 'per_kg_box' ? 'caixas' : product.unit})</Text>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType={pricingMode === 'per_kg_box' ? 'number-pad' : 'decimal-pad'} placeholder="1" placeholderTextColor={colors.text.tertiary} style={{ borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, padding: 12, backgroundColor: colors.background.surface, color: colors.text.primary }} />
          <Text style={[textStyle('small'), { color: colors.text.secondary }]}>Total estimado: {centsToBRL(Number.isFinite(estimatedTotalCents) ? estimatedTotalCents : 0)}</Text>
        </View>

        <View style={{ gap: spacing['2'] }}>
          <Button title="Adicionar ao carrinho" onPress={onAddToCart} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
