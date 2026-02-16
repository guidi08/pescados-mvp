import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/supabaseClient';
import { CartProvider } from './src/context/CartContext';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SellerScreen from './src/screens/SellerScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PixScreen from './src/screens/PixScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import WalletScreen from './src/screens/WalletScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Seller: { sellerId: string; sellerName: string };
  Product: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  Pix: { orderId: string; pix: any; total: string };
  Orders: undefined;
  Wallet: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  return (
    <StripeProvider publishableKey={publishableKey} merchantIdentifier="merchant.com.seudominio.pescados">
      <CartProvider>
        <NavigationContainer>
          <Stack.Navigator>
            {!session ? (
              <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
            ) : (
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Pescados' }} />
                <Stack.Screen name="Seller" component={SellerScreen} options={{ title: 'Fornecedor' }} />
                <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Produto' }} />
                <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Carrinho' }} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
                <Stack.Screen name="Pix" component={PixScreen} options={{ title: 'Pix' }} />
                <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Meus pedidos' }} />
                <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Saldo' }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </CartProvider>
    </StripeProvider>
  );
}
