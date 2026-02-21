import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, UIManager } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EntryScreen from './src/screens/EntryScreen';
import SupplierAccessScreen from './src/screens/SupplierAccessScreen';
import LoginScreen from './src/screens/LoginScreen';
import AuthCallbackScreen from './src/screens/AuthCallbackScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SellerScreen from './src/screens/SellerScreen';
import ProductScreen from './src/screens/ProductScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PixScreen from './src/screens/PixScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import AccountScreen from './src/screens/AccountScreen';
import WalletScreen from './src/screens/WalletScreen';

import { CartProvider } from './src/context/CartContext';
import { BuyerProvider } from './src/context/BuyerContext';
import CartBar from './src/components/CartBar';
import { colors } from './src/theme';

// Enable LayoutAnimation on Android (micro-transitions for cart, lists, etc.)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type RootStackParamList = {
  Entry: undefined;
  SupplierAccess: undefined;
  Login: { role: 'buyer' | 'seller' };
  AuthCallback: undefined;
  MainTabs: undefined;
  Seller: { sellerId: string; sellerName?: string };
  Product: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  Pix: { orderId: string; pix: any; total: string };
  Orders: undefined;
  OrderDetail: { orderId: string };
  Account: undefined;
  Wallet: undefined;
};

export type MainTabParamList = {
  SellersTab: undefined;
  ProductsTab: {
    initialCategory?: string;
    initialFreshFilter?: 'all' | 'fresh' | 'frozen';
    focusSearch?: boolean;
  };
  ProfileTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.background.surface,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            SellersTab: focused ? 'storefront' : 'storefront-outline',
            ProductsTab: focused ? 'search' : 'search-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          const name = iconMap[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="SellersTab" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="ProductsTab" component={ProductsScreen} options={{ title: 'Busca' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [navReady, setNavReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);

  // Deep linking for Supabase auth callback
  const linking = {
    prefixes: [Linking.createURL('/'), 'lotepro://'],
    config: {
      screens: {
        AuthCallback: 'auth/callback',
      },
    },
  };

  // Optional: keep last known route for CartBar hide logic (handled by getCurrentRoute)
  useEffect(() => {
    // noop
  }, []);

  return (
    <SafeAreaProvider>
      <BuyerProvider>
        <CartProvider>
          <NavigationContainer
            ref={navigationRef}
            linking={linking as any}
            onReady={() => {
              setNavReady(true);
              const name = navigationRef.current?.getCurrentRoute?.()?.name ?? null;
              setCurrentRoute(name);
            }}
            onStateChange={() => {
              const name = navigationRef.current?.getCurrentRoute?.()?.name ?? null;
              setCurrentRoute(name);
            }}
          >
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.background.app },
            }}
          >
            <Stack.Screen name="Entry" component={EntryScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="SupplierAccess" component={SupplierAccessScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} />
            <Stack.Screen name="MainTabs" component={TabNavigator} />

            <Stack.Screen
              name="Seller"
              component={SellerScreen}
              options={{
                headerShown: true,
                title: 'Fornecedor',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="Product"
              component={ProductScreen}
              options={{
                headerShown: true,
                title: 'Produto',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />

            <Stack.Screen name="Cart" component={CartScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                headerShown: true,
                title: 'Checkout',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="Pix"
              component={PixScreen}
              options={{
                headerShown: true,
                title: 'Pix',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />

            <Stack.Screen
              name="Orders"
              component={OrdersScreen}
              options={{
                headerShown: true,
                title: 'Pedidos',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="Account"
              component={AccountScreen}
              options={{
                headerShown: true,
                title: 'Dados da conta',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="Wallet"
              component={WalletScreen}
              options={{
                headerShown: true,
                title: 'Saldo',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
          </Stack.Navigator>

          {/* Sticky iFood-like bar */}
          {navReady && navigationRef.current ? (
            <CartBar navigationRef={navigationRef.current} currentRouteName={currentRoute} />
          ) : null}
        </NavigationContainer>
      </CartProvider>
    </BuyerProvider>
  </SafeAreaProvider>
  );
}
