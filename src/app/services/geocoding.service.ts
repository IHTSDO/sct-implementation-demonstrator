// src/app/services/geocoding.service.ts
import { Injectable } from '@angular/core';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private provider = new OpenStreetMapProvider({
    // Optional provider config here
    params: {
      addressdetails: 1, // Include additional address detail in the result
      // 'accept-language': 'en', // specify language if needed
    },
  });

  async search(query: string) {
    if (!query) {
      return [];
    }
    try {
      const results = await this.provider.search({ query });
      return results; // array of results
    } catch (error) {
      console.error('Error searching location:', error);
      return [];
    }
  }

  async getAdministrativeBoundary(placeId: number) {
    const url = `https://nominatim.openstreetmap.org/details.php?format=json&place_id=${placeId}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch administrative boundary: ${response.statusText}`);
      }
      const data = await response.json();

      if (data && data.geometry && data.geometry.coordinates) {
        return data.geometry.coordinates; // Returns boundary coordinates
      } else if (data.boundingbox) {
        return [
          [parseFloat(data.boundingbox[0]), parseFloat(data.boundingbox[2])], // Southwest corner
          [parseFloat(data.boundingbox[1]), parseFloat(data.boundingbox[3])]  // Northeast corner
        ];
      } else {
        console.warn('No boundary data found');
        return null;
      }
    } catch (error) {
      console.error('Error fetching administrative boundary:', error);
      return null;
    }
  }
}
