import Geolocation from 'react-native-geolocation-service';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {LocationData} from '@/types';

export interface TravelTimeResult {
  duration: number; // minutes
  distance: number; // meters
  mode: 'driving' | 'walking' | 'transit';
  route?: {
    coordinates: Array<{latitude: number; longitude: number}>;
    instructions: string[];
  };
}

export interface LocationPermissionStatus {
  granted: boolean;
  canRequest: boolean;
  message: string;
}

export class LocationService {
  private static instance: LocationService;
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private locationUpdateCallbacks: Array<(location: LocationData) => void> = [];

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async checkPermissions(): Promise<LocationPermissionStatus> {
    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
      : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    try {
      const result = await check(permission);
      
      switch (result) {
        case RESULTS.GRANTED:
          return {
            granted: true,
            canRequest: false,
            message: 'Location permission granted',
          };
        
        case RESULTS.DENIED:
          return {
            granted: false,
            canRequest: true,
            message: 'Location permission denied but can be requested',
          };
        
        case RESULTS.BLOCKED:
          return {
            granted: false,
            canRequest: false,
            message: 'Location permission blocked. Please enable in settings.',
          };
        
        case RESULTS.UNAVAILABLE:
          return {
            granted: false,
            canRequest: false,
            message: 'Location services are not available on this device',
          };
        
        default:
          return {
            granted: false,
            canRequest: true,
            message: 'Unknown permission status',
          };
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return {
        granted: false,
        canRequest: false,
        message: 'Error checking permissions',
      };
    }
  }

  async requestPermissions(): Promise<LocationPermissionStatus> {
    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
      : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    try {
      const result = await request(permission);
      
      switch (result) {
        case RESULTS.GRANTED:
          return {
            granted: true,
            canRequest: false,
            message: 'Location permission granted',
          };
        
        case RESULTS.DENIED:
          return {
            granted: false,
            canRequest: true,
            message: 'Location permission denied',
          };
        
        case RESULTS.BLOCKED:
          return {
            granted: false,
            canRequest: false,
            message: 'Location permission blocked. Please enable in settings.',
          };
        
        default:
          return {
            granted: false,
            canRequest: false,
            message: 'Permission request failed',
          };
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return {
        granted: false,
        canRequest: false,
        message: 'Error requesting permissions',
      };
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    const permissionStatus = await this.checkPermissions();
    
    if (!permissionStatus.granted) {
      if (permissionStatus.canRequest) {
        const requestResult = await this.requestPermissions();
        if (!requestResult.granted) {
          Alert.alert(
            'Location Permission Required',
            'Location access is needed to calculate travel times and provide location-based features.',
            [
              {text: 'Cancel', style: 'cancel'},
              {text: 'Settings', onPress: () => {
                // Open app settings
                console.log('Open app settings');
              }},
            ]
          );
          return null;
        }
      } else {
        Alert.alert(
          'Location Access Blocked',
          permissionStatus.message,
          [{text: 'OK'}]
        );
        return null;
      }
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          this.currentLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Error getting current location:', error);
          
          let message = 'Unable to get your current location.';
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              message = 'Location permission denied.';
              break;
            case 2: // POSITION_UNAVAILABLE
              message = 'Location information is unavailable.';
              break;
            case 3: // TIMEOUT
              message = 'Location request timed out.';
              break;
          }
          
          Alert.alert('Location Error', message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  startLocationTracking(callback: (location: LocationData) => void): void {
    this.locationUpdateCallbacks.push(callback);
    
    if (this.watchId !== null) {
      // Already tracking, just add the callback
      return;
    }

    this.getCurrentLocation().then(() => {
      this.watchId = Geolocation.watchPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          this.currentLocation = location;
          
          // Notify all callbacks
          this.locationUpdateCallbacks.forEach(cb => cb(location));
        },
        (error) => {
          console.error('Error watching location:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Update every 10 meters
          interval: 30000, // Update every 30 seconds
          fastestInterval: 10000, // Fastest update every 10 seconds
        }
      );
    }).catch((error) => {
      console.error('Failed to start location tracking:', error);
    });
  }

  stopLocationTracking(callback?: (location: LocationData) => void): void {
    if (callback) {
      this.locationUpdateCallbacks = this.locationUpdateCallbacks.filter(cb => cb !== callback);
    } else {
      this.locationUpdateCallbacks = [];
    }
    
    if (this.locationUpdateCallbacks.length === 0 && this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async calculateTravelTime(
    from: {latitude: number; longitude: number} | 'current',
    to: {latitude: number; longitude: number},
    mode: 'driving' | 'walking' | 'transit' = 'driving'
  ): Promise<TravelTimeResult | null> {
    try {
      let fromLocation: {latitude: number; longitude: number};
      
      if (from === 'current') {
        const currentLoc = await this.getCurrentLocation();
        if (!currentLoc) {
          throw new Error('Unable to get current location');
        }
        fromLocation = {
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
        };
      } else {
        fromLocation = from;
      }

      // In a real app, this would call a routing service like Google Maps API
      // For now, we'll calculate a simple estimate based on distance
      const distance = this.calculateDistance(fromLocation, to);
      
      let duration: number;
      switch (mode) {
        case 'walking':
          duration = Math.ceil(distance / 80); // ~5 km/h walking speed
          break;
        case 'transit':
          duration = Math.ceil(distance / 400); // ~25 km/h average transit speed
          break;
        case 'driving':
        default:
          duration = Math.ceil(distance / 800); // ~50 km/h average driving speed in city
          break;
      }

      return {
        duration: Math.max(duration, 1), // Minimum 1 minute
        distance: Math.round(distance),
        mode,
        route: {
          coordinates: [fromLocation, to], // Simple direct route
          instructions: [`Head ${this.getDirection(fromLocation, to)} to destination`],
        },
      };
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return null;
    }
  }

  private calculateDistance(
    from: {latitude: number; longitude: number},
    to: {latitude: number; longitude: number}
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) * Math.cos(this.toRadians(to.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getDirection(
    from: {latitude: number; longitude: number},
    to: {latitude: number; longitude: number}
  ): string {
    const dLat = to.latitude - from.latitude;
    const dLon = to.longitude - from.longitude;
    
    const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
    
    if (angle >= -22.5 && angle < 22.5) return 'north';
    if (angle >= 22.5 && angle < 67.5) return 'northeast';
    if (angle >= 67.5 && angle < 112.5) return 'east';
    if (angle >= 112.5 && angle < 157.5) return 'southeast';
    if (angle >= 157.5 || angle < -157.5) return 'south';
    if (angle >= -157.5 && angle < -112.5) return 'southwest';
    if (angle >= -112.5 && angle < -67.5) return 'west';
    if (angle >= -67.5 && angle < -22.5) return 'northwest';
    
    return 'toward';
  }

  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }

  async geocodeAddress(address: string): Promise<{latitude: number; longitude: number} | null> {
    // In a real app, this would use a geocoding service
    // For now, return null to indicate geocoding is not available
    console.log('Geocoding not implemented for address:', address);
    return null;
  }

  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    // In a real app, this would use a reverse geocoding service
    // For now, return a simple coordinate string
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}