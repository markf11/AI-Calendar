import {Platform, PermissionsAndroid, Alert} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {LocationService} from '../LocationService';

// Mock dependencies
jest.mock('react-native-geolocation-service');
jest.mock('react-native-permissions');
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  PermissionsAndroid: {
    request: jest.fn(),
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
  },
  Alert: {
    alert: jest.fn(),
  },
}));

const mockGeolocation = Geolocation as jest.Mocked<typeof Geolocation>;
const mockCheck = check as jest.MockedFunction<typeof check>;
const mockRequest = request as jest.MockedFunction<typeof request>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    locationService = LocationService.getInstance();
  });

  describe('checkPermissions', () => {
    it('should return granted status when permission is granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      const result = await locationService.checkPermissions();

      expect(result).toEqual({
        granted: true,
        canRequest: false,
        message: 'Location permission granted',
      });
    });

    it('should return denied status when permission is denied', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);

      const result = await locationService.checkPermissions();

      expect(result).toEqual({
        granted: false,
        canRequest: true,
        message: 'Location permission denied but can be requested',
      });
    });

    it('should return blocked status when permission is blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);

      const result = await locationService.checkPermissions();

      expect(result).toEqual({
        granted: false,
        canRequest: false,
        message: 'Location permission blocked. Please enable in settings.',
      });
    });

    it('should handle permission check errors', async () => {
      mockCheck.mockRejectedValue(new Error('Permission error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await locationService.checkPermissions();

      expect(result).toEqual({
        granted: false,
        canRequest: false,
        message: 'Error checking permissions',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('requestPermissions', () => {
    it('should return granted status when permission is granted', async () => {
      mockRequest.mockResolvedValue(RESULTS.GRANTED);

      const result = await locationService.requestPermissions();

      expect(result).toEqual({
        granted: true,
        canRequest: false,
        message: 'Location permission granted',
      });
    });

    it('should return denied status when permission is denied', async () => {
      mockRequest.mockResolvedValue(RESULTS.DENIED);

      const result = await locationService.requestPermissions();

      expect(result).toEqual({
        granted: false,
        canRequest: true,
        message: 'Location permission denied',
      });
    });

    it('should handle permission request errors', async () => {
      mockRequest.mockRejectedValue(new Error('Request error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await locationService.requestPermissions();

      expect(result).toEqual({
        granted: false,
        canRequest: false,
        message: 'Error requesting permissions',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentLocation', () => {
    it('should return current location when permission is granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition as any);
      });

      const result = await locationService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: mockPosition.timestamp,
      });
    });

    it('should request permission if not granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      mockRequest.mockResolvedValue(RESULTS.GRANTED);
      
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition as any);
      });

      const result = await locationService.getCurrentLocation();

      expect(mockRequest).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should show alert when permission is blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);

      const result = await locationService.getCurrentLocation();

      expect(mockAlert).toHaveBeenCalledWith(
        'Location Access Blocked',
        expect.any(String),
        expect.any(Array)
      );
      expect(result).toBeNull();
    });

    it('should handle geolocation errors', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'Permission denied',
        } as any);
      });

      const result = await locationService.getCurrentLocation();

      expect(mockAlert).toHaveBeenCalledWith(
        'Location Error',
        'Location permission denied.'
      );
      expect(result).toBeNull();
    });
  });

  describe('calculateTravelTime', () => {
    beforeEach(() => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition as any);
      });
    });

    it('should calculate travel time from current location', async () => {
      const destination = { latitude: 37.7849, longitude: -122.4094 };

      const result = await locationService.calculateTravelTime('current', destination, 'driving');

      expect(result).toBeTruthy();
      expect(result?.mode).toBe('driving');
      expect(result?.duration).toBeGreaterThan(0);
      expect(result?.distance).toBeGreaterThan(0);
    });

    it('should calculate travel time between two points', async () => {
      const from = { latitude: 37.7749, longitude: -122.4194 };
      const to = { latitude: 37.7849, longitude: -122.4094 };

      const result = await locationService.calculateTravelTime(from, to, 'walking');

      expect(result).toBeTruthy();
      expect(result?.mode).toBe('walking');
      expect(result?.duration).toBeGreaterThan(0);
    });

    it('should return different durations for different modes', async () => {
      const from = { latitude: 37.7749, longitude: -122.4194 };
      const to = { latitude: 37.8749, longitude: -122.3194 }; // Longer distance

      const drivingResult = await locationService.calculateTravelTime(from, to, 'driving');
      const walkingResult = await locationService.calculateTravelTime(from, to, 'walking');

      expect(walkingResult?.duration).toBeGreaterThan(drivingResult?.duration || 0);
    });

    it('should handle calculation errors', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({
          code: 2, // POSITION_UNAVAILABLE
          message: 'Position unavailable',
        } as any);
      });

      const destination = { latitude: 37.7849, longitude: -122.4094 };
      const result = await locationService.calculateTravelTime('current', destination);

      expect(result).toBeNull();
    });

    it('should return minimum 1 minute duration', async () => {
      const from = { latitude: 37.7749, longitude: -122.4194 };
      const to = { latitude: 37.7749, longitude: -122.4194 }; // Same location

      const result = await locationService.calculateTravelTime(from, to);

      expect(result?.duration).toBe(1);
    });
  });

  describe('startLocationTracking', () => {
    it('should start location tracking with callback', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition as any);
      });

      mockGeolocation.watchPosition.mockReturnValue(123);

      const callback = jest.fn();
      locationService.startLocationTracking(callback);

      // Wait for getCurrentLocation to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
    });

    it('should not start multiple watchers', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 10 },
          timestamp: Date.now(),
        } as any);
      });
      mockGeolocation.watchPosition.mockReturnValue(123);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      locationService.startLocationTracking(callback1);
      await new Promise(resolve => setTimeout(resolve, 0));

      locationService.startLocationTracking(callback2);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopLocationTracking', () => {
    it('should stop location tracking when no callbacks remain', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 10 },
          timestamp: Date.now(),
        } as any);
      });
      mockGeolocation.watchPosition.mockReturnValue(123);
      mockGeolocation.clearWatch.mockImplementation(() => {});

      const callback = jest.fn();
      locationService.startLocationTracking(callback);
      await new Promise(resolve => setTimeout(resolve, 0));

      locationService.stopLocationTracking(callback);

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(123);
    });

    it('should not stop tracking if other callbacks exist', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 10 },
          timestamp: Date.now(),
        } as any);
      });
      mockGeolocation.watchPosition.mockReturnValue(123);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      locationService.startLocationTracking(callback1);
      locationService.startLocationTracking(callback2);
      await new Promise(resolve => setTimeout(resolve, 0));

      locationService.stopLocationTracking(callback1);

      expect(mockGeolocation.clearWatch).not.toHaveBeenCalled();
    });
  });
});