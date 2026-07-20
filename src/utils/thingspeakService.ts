// ThingSpeak API service untuk mengambil data sensor berat
const THINGSPEAK_CHANNEL_ID = '3066567';
const THINGSPEAK_API_KEY = 'KG91MOPCJ1U0HTGO';
// Use proxy endpoint instead of direct ThingSpeak URL
const THINGSPEAK_BASE_URL = '/api/thingspeak';

export interface ThingSpeakFeed {
  created_at: string;
  entry_id: number;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
}

export interface ThingSpeakResponse {
  channel: {
    id: number;
    name: string;
    description: string;
    latitude: string;
    longitude: string;
    field1: string;
    field2: string;
    field3: string;
    field4: string;
    field5: string;
    field6: string;
    field7: string;
    field8: string;
    created_at: string;
    updated_at: string;
    last_entry_id: number;
  };
  feeds: ThingSpeakFeed[];
}

export class ThingSpeakService {
  private static getApiUrl(): string {
    return `/api/thingspeak/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_API_KEY}&results=1`;
  }

  /**
   * Mengambil data terbaru dari ThingSpeak
   * @returns Promise dengan data berat atau null jika gagal
   */
  static async fetchLatestWeight(): Promise<number | null> {
    try {
      const url = this.getApiUrl();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ThingSpeakResponse = await response.json();
      
      if (data.feeds && data.feeds.length > 0) {
        const latestFeed = data.feeds[0];
        const weightValue = latestFeed.field1;
        
        if (weightValue) {
          const weight = parseFloat(weightValue);
          return isNaN(weight) ? null : weight;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching weight data:', error);
      throw error;
    }
  }

  /**
   * Mengambil informasi channel ThingSpeak
   * @returns Promise dengan informasi channel
   */
  static async getChannelInfo(): Promise<ThingSpeakResponse['channel'] | null> {
    try {
      const response = await fetch(this.getApiUrl());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ThingSpeakResponse = await response.json();
      return data.channel;
    } catch (error) {
      console.error('ThingSpeak Channel Info Error:', error);
      return null;
    }
  }

  /**
   * Test koneksi ke ThingSpeak API
   * @returns Promise<boolean> - true jika koneksi berhasil
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.getApiUrl());
      return response.ok;
    } catch (error) {
      console.error('ThingSpeak Connection Test Failed:', error);
      return false;
    }
  }
}

export default ThingSpeakService;