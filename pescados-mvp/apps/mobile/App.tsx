import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { supabase } from './src/supabaseClient';
import { CartProvider } from './src/context/CartContext';
import { BuyerProvider } from './src/context/BuyerContext';

import EntryScreen from './src/screens/EntryScreen';
import SupplierAccessScreen from './src/screens/SupplierAccessScreen';
import LoginScreen from './src/screens/LoginScreen';
import AuthCallbackScreen from './src/screens/AuthCallbackScreen';

import SellersScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import SellerScreen from './src/screens/SellerScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PixScreen from './src/screens/PixScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import WalletScreen from './src/screens/WalletScreen';
import AccountScreen from './src/screens/AccountScreen';

import CartBar from './src/components/CartBar';
import { colors } from './src/theme';

export type RootStackParamList = {
  Entry: undefined;
  SupplierAccess: undefined;
  Login: { role?: 'buyer' | 'seller' } | undefined;
  AuthCallback: { code?: string } | undefined;

  MainTabs: undefined;

  Seller: { sellerId: string; sellerName: string };
  Product: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  Pix: { orderId: string; pix: any; total: string };

  Orders: undefined;
  Wallet: undefined;
  Account: undefined;
};

export type MainTabParamList = {
  SellersTab: undefined;
  ProductsTab: undefined;
  ProfileTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border.subtle },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === 'SellersTab'
              ? 'storefront-outline'
              : route.name === 'ProductsTab'
                ? 'pricetags-outline'
                : 'person-circle-outline';

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="SellersTab" component={SellersScreen} options={{ title: 'Fornecedores' }} />
      <Tab.Screen name="ProductsTab" component={ProductsScreen} options={{ title: 'Produtos' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      AuthCallback: 'auth/callback',
    },
  },
};

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  const stripeMerchantId = useMemo(() => {
    // Apple Pay (iOS) merchant identifier. You MUST change this when configuring Apple Pay.
    // Ex.: merchant.io.guestengine.lotepro
    return 'merchant.io.guestengine.lotepro';
  }, []);

  return (
    <StripeProvider publishableKey={publishableKey} merchantIdentifier={stripeMerchantId}>
      <SafeAreaProvider>
        <BuyerProvider>
          <CartProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <View style={{ flex: 1 }}>
                <Stack.Navigator
                  screenOptions={{
                    headerTitleAlign: 'center',
                    animation: 'fade',
                  }}
                >
                  {!session ? (
                    <>
                      <Stack.Screen name="Entry" component={EntryScreen} options={{ headerShown: false }} />
                      <Stack.Screen name="SupplierAccess" component={SupplierAccessScreen} options={{ title: 'Fornecedor' }} />
                      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
                      <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ title: 'Confirmando...' }} />
                    </>
                  ) : (
                    <>
                      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
                      <Stack.Screen name="Seller" component={SellerScreen} options={{ title: 'Fornecedor' }} />
                      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Produto' }} />
                      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Carrinho' }} />
                      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
                      <Stack.Screen name="Pix" component={PixScreen} options={{ title: 'Pix' }} />
                      <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Meus pedidos' }} />
                      <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Ajustes' }} />
                      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Dados da conta' }} />

                      {/* Auth callback can also be opened when already logged in */}
                      <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ title: 'Confirmando...' }} />
                    </>
                  )}
                </Stack.Navigator>

                {/* Bottom cart bar (estilo iFood) */}
                <CartBar navigationRef={navigationRef} />
              </View>
            </NavigationContainer>

            <StatusBar style="dark" />
          </CartProvider>
        </BuyerProvider>
      </SafeAreaProvider>
    </StripeProvider>
  );
}
