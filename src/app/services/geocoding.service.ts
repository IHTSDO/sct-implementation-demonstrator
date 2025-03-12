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
}
