// src/lib/stores/settings.svelte.ts
import { browser } from '$app/environment';

class SettingsStore {
  private _apiKey = $state<string>('');
  private _initialized = $state<boolean>(false);

  constructor() {
    if (browser) {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('alchemy_api_key');
      this._apiKey = stored || '';
      this._initialized = true;
      console.log('Settings loaded from storage:', { hasKey: !!this._apiKey });
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
      this._apiKey = '';
      this._initialized = true;
    }
  }

  get apiKey() {
    return this._apiKey;
  }

  set apiKey(value: string) {
    this._apiKey = value;
    if (browser) {
      try {
        if (value) {
          localStorage.setItem('alchemy_api_key', value);
        } else {
          localStorage.removeItem('alchemy_api_key');
        }
        console.log('Settings saved to storage:', { hasKey: !!value });
      } catch (error) {
        console.error('Failed to save settings to storage:', error);
      }
    }
  }

  get hasApiKey() {
    return this._initialized && this._apiKey.length > 0;
  }

  get isInitialized() {
    return this._initialized;
  }
}

export const settings = new SettingsStore();