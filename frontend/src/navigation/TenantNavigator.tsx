import LoadingView from '../components/LoadingView';
import UnitHistoryScreen from '../screens/tenant/UnitHistoryScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PrivacySecurityScreen from '../screens/shared/PrivacySecurityScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import TenantTabs from './TenantTabs';

import GuidedInspectionScreen from '../screens/tenant/GuidedInspectionScreen';
import ReportMaintenanceScreen from '../screens/tenant/ReportMaintenanceScreen';
import InspectionAvailabilityScreen from '../screens/tenant/InspectionAvailabilityScreen';
import MaintenanceDetailScreen from '../screens/tenant/MaintenanceDetailScreen';
import ReviewInspectionPhotoScreen from '../screens/tenant/ReviewInspectionPhotoScreen';
import InspectionSubmittedScreen from '../screens/tenant/InspectionSubmittedScreen';

import type { TenantGateStackParamList, TenantStackParamList } from './types';
import { InspectionProvider } from '../context/InspectionContext';
import {
  TenantDemoProvider,
  useTenantDemo,
} from '../context/TenantDemoContext';
import AddedToUnitScreen from '../screens/tenant/AddedToUnitScreen';
import TenantConsentScreen from '../screens/tenant/TenantConsentScreen';
import TenantInvitePromptScreen from '../screens/tenant/TenantInvitePromptScreen';
import TenantBaselineScreen from '../screens/tenant/TenantBaselineScreen';
import TenantMovePhotosScreen from '../screens/tenant/TenantMovePhotosScreen';
import TenantPickTimeScreen from '../screens/tenant/TenantPickTimeScreen';
import TenantInspectionCaptureScreen from '../screens/tenant/TenantInspectionCaptureScreen';
import TenantInspectionPhotoScreen from '../screens/tenant/TenantInspectionPhotoScreen';
import TenantInspectionReviewScreen from '../screens/tenant/TenantInspectionReviewScreen';
import TenantInspectionDoneScreen from '../screens/tenant/TenantInspectionDoneScreen';

const Stack = createNativeStackNavigator<TenantStackParamList>();
const Gate = createNativeStackNavigator<TenantGateStackParamList>();

function TenantGate({ stage }: { stage: 'invite' | 'welcome' | 'consent' }) {
  return (
    <Gate.Navigator screenOptions={{ headerShown: false }}>
      {stage === 'invite' ? (
        <Gate.Screen name="TenantInvite" component={TenantInvitePromptScreen} />
      ) : stage === 'welcome' ? (
        <Gate.Screen name="TenantWelcome" component={AddedToUnitScreen} />
      ) : (
        <Gate.Screen name="TenantConsent">
          {({ navigation }) => (
            <TenantConsentScreen
              onReadPolicy={() => navigation.navigate('TenantConsentPolicy')}
            />
          )}
        </Gate.Screen>
      )}
      <Gate.Screen name="TenantConsentPolicy" component={PrivacyPolicyScreen} />
    </Gate.Navigator>
  );
}

export default function TenantNavigator() {
  return (
    <TenantDemoProvider>
      <TenantStack />
    </TenantDemoProvider>
  );
}

function TenantStack() {
  const { stage } = useTenantDemo();
  if (stage === 'loading') {
    return <LoadingView />;
  }
  if (stage !== 'ready') {
    return <TenantGate stage={stage} />;
  }
  return (
    <InspectionProvider>
      <Stack.Navigator>
        <Stack.Screen
          name="TenantTabs"
          component={TenantTabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="History"
          component={UnitHistoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacySecurity"
          component={PrivacySecurityScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="GuidedInspection"
          component={GuidedInspectionScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ReportMaintenance"
          component={ReportMaintenanceScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="InspectionAvailability"
          component={InspectionAvailabilityScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="MaintenanceDetail"
          component={MaintenanceDetailScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ReviewInspectionPhoto"
          component={ReviewInspectionPhotoScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="TenantBaseline"
          component={TenantBaselineScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantMovePhotos"
          component={TenantMovePhotosScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantPickTime"
          component={TenantPickTimeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantInspectionCapture"
          component={TenantInspectionCaptureScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantInspectionPhoto"
          component={TenantInspectionPhotoScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantInspectionReview"
          component={TenantInspectionReviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TenantInspectionDone"
          component={TenantInspectionDoneScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="InspectionSubmitted"
          component={InspectionSubmittedScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </InspectionProvider>
  );
}
