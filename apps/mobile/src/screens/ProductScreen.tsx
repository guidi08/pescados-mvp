import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';

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

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProductScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');

  const { addItem } = useCart();

  async function load() {
    const { data: p } = await supabase
      .from('products')
      .select('*, sellers(display_name)')
      .eq('id', productId)
      .single();

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

    const channel = supabase
      .channel('realtime-product')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${productId}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [variants, selectedVariantId]);

  const unitPriceCents = selectedVariant ? selectedVariant.price_cents : (product?.base_price_cents ?? 0);
  const minExpiry = selectedVariant?.min_expiry_date ?? product?.min_expiry_date ?? null;

  const pricingMode = product?.pricing_mode ?? 'per_unit';
  const priceUnitLabel = pricingMode === 'per_kg_box' ? 'kg' : (product?.unit ?? 'un');

  const estimatedBoxWeightKg = product?.estimated_box_weight_kg ?? null;
  const maxVarPct = product?.max_weight_variation_pct ?? null;

  function parseQuantity(): number {
    const q = Number(quantity.replace(',', '.'));
    return q;
  }

  function onAddToCart() {
    if (!product) return;
    if (!product.active) {
      Alert.alert('Indisponível', 'Este produto está pausado.');
      return;
    }

    const q = parseQuantity();
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade válida.');
      return;
    }

    if (pricingMode === 'per_kg_box' && !Number.isInteger(q)) {
      Alert.alert('Quantidade inválida', 'Para produtos por caixa, a quantidade deve ser um número inteiro (ex.: 1, 2, 3...).');
      return;
    }

    const sellerName = (product as any).sellers?.display_name ?? 'Fornecedor';

    addItem(product.seller_id, sellerName, {
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
    });

    Alert.alert('Adicionado', 'Item adicionado ao carrinho.');
    navigation.navigate('Cart');
  }

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Carregando...</Text>
      </SafeAreaView>
    );
  }

  const qPreview = parseQuantity();
  const estimatedTotalCents =
    pricingMode === 'per_unit'
      ? Math.round(unitPriceCents * (Number.isFinite(qPreview) ? qPreview : 0))
      : Math.round(unitPriceCents * (Number(estimatedBoxWeightKg ?? 0) * (Number.isFinite(qPreview) ? qPreview : 0)));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{product.name}</Text>
        <Text style={{ color: '#666' }}>
          {(product as any).sellers?.display_name ? `Fornecedor: ${(product as any).sellers.display_name}` : ''}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ color: product.fresh ? '#166534' : '#444', fontWeight: '700' }}>
            {product.fresh ? 'FRESCO' : 'CONGELADO'}
          </Text>
          {minExpiry ? <Text style={{ color: '#666' }}>Validade mínima: {minExpiry}</Text> : null}
          {product.tags?.length ? <Text style={{ color: '#666' }}>• {product.tags.join(' • ')}</Text> : null}
        </View>

        {product.description ? <Text style={{ color: '#444' }}>{product.description}</Text> : null}

        {pricingMode === 'per_kg_box' ? (
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee' }}>
            <Text style={{ fontWeight: '800' }}>Produto por caixa (peso variável)</Text>
            <Text style={{ color: '#666', marginTop: 6 }}>
              Preço é por <Text style={{ fontWeight: '700' }}>kg</Text>. Você compra por <Text style={{ fontWeight: '700' }}>caixa</Text>.
            </Text>
            <Text style={{ color: '#666', marginTop: 6 }}>
              Peso estimado: <Text style={{ fontWeight: '700' }}>{estimatedBoxWeightKg ?? '—'} kg/caixa</Text>
              {maxVarPct ? ` • variação máx.: ${maxVarPct}%` : ''}
            </Text>
            <Text style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
              O valor final pode variar. Em B2B, o ajuste pode gerar crédito/débito no saldo do cliente.
            </Text>
          </View>
        ) : null}

        {variants.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700' }}>Escolha o calibre/tamanho</Text>
            <View style={{ gap: 8 }}>
              {variants.map((v) => (
                <Button
                  key={v.id}
                  title={`${selectedVariantId === v.id ? '✓ ' : ''}${v.name} — ${centsToBRL(v.price_cents)}/${priceUnitLabel}`}
                  onPress={() => setSelectedVariantId(v.id)}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 18 }}>{centsToBRL(product.base_price_cents)} / {priceUnitLabel}</Text>
        )}

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700' }}>
            Quantidade ({pricingMode === 'per_kg_box' ? 'caixas' : product.unit})
          </Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType={pricingMode === 'per_kg_box' ? 'number-pad' : 'decimal-pad'}
            placeholder="1"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}
          />
          <Text style={{ color: '#666' }}>
            Total estimado: {centsToBRL(Number.isFinite(estimatedTotalCents) ? estimatedTotalCents : 0)}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Button title="Adicionar ao carrinho" onPress={onAddToCart} />
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
