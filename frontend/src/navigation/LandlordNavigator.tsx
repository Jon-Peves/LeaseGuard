import {
  type BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomNavigation from '../components/BottomNavigation';
import PrivacySecurityScreen from '../screens/shared/PrivacySecurityScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';
import AIInspectionReviewScreen from '../screens/landlord/AIInspectionReviewScreen';
import ConditionHistoryScreen from '../screens/landlord/ConditionHistoryScreen';
import LandlordDashboardScreen from '../screens/landlord/LandlordDashboardScreen';
import ScheduleInspectionScreen from '../screens/landlord/ScheduleInspectionScreen';
import EditUnitScreen from '../screens/landlord/EditUnitScreen';
import MoveInTourScreen from '../screens/landlord/MoveInTourScreen';
import BaselineCaptureScreen from '../screens/landlord/BaselineCaptureScreen';
import ReviewBaselineScreen from '../screens/landlord/ReviewBaselineScreen';
import LandlordConsentScreen from '../screens/landlord/LandlordConsentScreen';
import {
  LandlordDemoProvider,
  useLandlordDemo,
} from '../context/LandlordDemoContext';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

import type {
  LandlordConsentStackParamList,
  LandlordSettingsStackParamList,
  LandlordStackParamList,
  LandlordTabParamList,
} from './types';

const Tab = createBottomTabNavigator<LandlordTabParamList>();
const Stack = createNativeStackNavigator<LandlordStackParamList>();
const SettingsStack =
  createNativeStackNavigator<LandlordSettingsStackParamList>();
const ConsentStack =
  createNativeStackNavigator<LandlordConsentStackParamList>();
function HomeStack() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Dashboard" component={LandlordDashboardScreen} />
      <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
      <Stack.Screen
        name="ScheduleInspection"
        component={ScheduleInspectionScreen}
      />
      <Stack.Screen
        name="AIInspectionReview"
        component={AIInspectionReviewScreen}
      />
      <Stack.Screen name="EditUnit" component={EditUnitScreen} />
      <Stack.Screen name="MoveInTour" component={MoveInTourScreen} />
      <Stack.Screen name="BaselineCapture" component={BaselineCaptureScreen} />
      <Stack.Screen name="ReviewBaseline" component={ReviewBaselineScreen} />
    </Stack.Navigator>
  );
}
function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator
      initialRouteName="SettingsHome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <SettingsStack.Screen name="SettingsHome">
        {({ navigation }) => (
          <SettingsScreen
            onPrivacySecurity={() => navigation.navigate('PrivacySecurity')}
            onProfile={() => navigation.navigate('Profile')}
          />
        )}
      </SettingsStack.Screen>

      <SettingsStack.Screen
        name="PrivacySecurity"
        component={PrivacySecurityScreen}
      />

      <SettingsStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
      />

      <SettingsStack.Screen name="Profile" component={ProfileScreen} />
    </SettingsStack.Navigator>
  );
}
function LandlordTabBar(props: BottomTabBarProps) {
  return <BottomNavigation {...props} role="landlord" />;
}

const homeOptions = { title: 'Home' };
const historyOptions = { title: 'History' };
const settingsOptions = { title: 'Settings' };

function ConsentGate() {
  return (
    <ConsentStack.Navigator screenOptions={{ headerShown: false }}>
      <ConsentStack.Screen name="Consent">
        {({ navigation }) => (
          <LandlordConsentScreen
            onReadPolicy={() => navigation.navigate('ConsentPolicy')}
          />
        )}
      </ConsentStack.Screen>
      <ConsentStack.Screen
        name="ConsentPolicy"
        component={PrivacyPolicyScreen}
      />
    </ConsentStack.Navigator>
  );
}

function LandlordTabs() {
  const { consented } = useLandlordDemo();
  if (!consented) {
    return <ConsentGate />;
  }
  return (
    <Tab.Navigator
      initialRouteName="HomeStack"
      tabBar={LandlordTabBar}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
        options={homeOptions}
      />
      <Tab.Screen
        name="History"
        component={ConditionHistoryScreen}
        options={historyOptions}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackScreen}
        options={settingsOptions}
      />
    </Tab.Navigator>
  );
}

export default function LandlordNavigator({
  initialConsented,
}: {
  initialConsented?: boolean;
}) {
  return (
    <LandlordDemoProvider initialConsented={initialConsented}>
      <LandlordTabs />
    </LandlordDemoProvider>
  );
}
