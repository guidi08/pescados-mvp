import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { NativeModules, Platform, UIManager } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Stripe native module is only available in dev-client / production builds.
// In Expo Go it's absent, so we skip the provider to avoid a crash.
export const isStripeAvailable = !!NativeModules.StripeContainerManager;
let StripeProvider: any = ({ children }: any) => children; // no-op fallback
if (isStripeAvailable) {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
}

// Buyer screens
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
import AddressScreen from './src/screens/AddressScreen';
import WalletScreen from './src/screens/WalletScreen';

// Supplier screens
import SupplierDashboardScreen from './src/screens/supplier/SupplierDashboardScreen';
import SupplierProductsScreen from './src/screens/supplier/SupplierProductsScreen';
import SupplierProductNewScreen from './src/screens/supplier/SupplierProductNewScreen';
import SupplierProductDetailScreen from './src/screens/supplier/SupplierProductDetailScreen';
import SupplierOrdersScreen from './src/screens/supplier/SupplierOrdersScreen';
import SupplierOrderDetailScreen from './src/screens/supplier/SupplierOrderDetailScreen';
import SupplierSettingsScreen from './src/screens/supplier/SupplierSettingsScreen';

import { CartProvider } from './src/context/CartContext';
import { BuyerProvider } from './src/context/BuyerContext';
import { SellerProvider } from './src/context/SellerContext';
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
  Address: undefined;
  Wallet: undefined;
  // Supplier
  SupplierTabs: undefined;
  SupplierProductNew: undefined;
  SupplierProductDetail: { productId: string };
  SupplierOrderDetail: { orderId: string };
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

export type SupplierTabParamList = {
  PainelTab: undefined;
  ProdutosTab: undefined;
  PedidosTab: undefined;
  ConfigTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const SupplierTab = createBottomTabNavigator<SupplierTabParamList>();

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

function SupplierTabNavigator() {
  return (
    <SupplierTab.Navigator
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
        tabBarLabelStyle: { fontSize: 12 },
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            PainelTab: focused ? 'grid' : 'grid-outline',
            ProdutosTab: focused ? 'cube' : 'cube-outline',
            PedidosTab: focused ? 'receipt' : 'receipt-outline',
            ConfigTab: focused ? 'settings' : 'settings-outline',
          };
          const name = iconMap[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <SupplierTab.Screen name="PainelTab" component={SupplierDashboardScreen} options={{ title: 'Painel' }} />
      <SupplierTab.Screen name="ProdutosTab" component={SupplierProductsScreen} options={{ title: 'Produtos' }} />
      <SupplierTab.Screen name="PedidosTab" component={SupplierOrdersScreen} options={{ title: 'Pedidos' }} />
      <SupplierTab.Screen name="ConfigTab" component={SupplierSettingsScreen} options={{ title: 'Config' }} />
    </SupplierTab.Navigator>
  );
}

// Routes where CartBar should be hidden
const SUPPLIER_ROUTES = new Set([
  'SupplierTabs', 'PainelTab', 'ProdutosTab', 'PedidosTab', 'ConfigTab',
  'SupplierProductNew', 'SupplierProductDetail', 'SupplierOrderDetail',
]);

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

  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  // Check if current route is a supplier route (hide CartBar)
  const isSupplierRoute = currentRoute ? SUPPLIER_ROUTES.has(currentRoute) : false;

  return (
    <SafeAreaProvider>
      <StripeProvider
        publishableKey={stripePublishableKey}
        merchantIdentifier="merchant.com.guestengine.lotepro"
      >
      <BuyerProvider>
        <SellerProvider>
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

            {/* Supplier screens */}
            <Stack.Screen name="SupplierTabs" component={SupplierTabNavigator} />
            <Stack.Screen
              name="SupplierProductNew"
              component={SupplierProductNewScreen}
              options={{
                headerShown: true,
                title: 'Novo Produto',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="SupplierProductDetail"
              component={SupplierProductDetailScreen}
              options={{
                headerShown: true,
                title: 'Produto',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />
            <Stack.Screen
              name="SupplierOrderDetail"
              component={SupplierOrderDetailScreen}
              options={{
                headerShown: true,
                title: 'Detalhes do Pedido',
                headerTintColor: colors.brand.primary,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.surface },
              }}
            />

            {/* Buyer screens */}
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
              name="Address"
              component={AddressScreen}
              options={{
                headerShown: true,
                title: 'Endereço de entrega',
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

          {/* Sticky iFood-like bar — hidden on supplier routes */}
          {navReady && navigationRef.current && !isSupplierRoute ? (
            <CartBar navigationRef={navigationRef.current} currentRouteName={currentRoute} />
          ) : null}
        </NavigationContainer>
      </CartProvider>
      </SellerProvider>
    </BuyerProvider>
    </StripeProvider>
  </SafeAreaProvider>
  );
}
