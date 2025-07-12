// src/lib/stores/settings.svelte.ts
import { browser } from '$app/environment';

class SettingsStore {
  private _apiKey = $state<string>('');

  constructor() {
    if (browser) {
      this._apiKey = localStorage.getItem('api_key') || '';
    }
  }

  get apiKey() {
    return this._apiKey;
  }

  set apiKey(value: string) {
    this._apiKey = value;
    if (browser) {
      localStorage.setItem('api_key', value);
    }
  }

  get hasApiKey() {
    return this._apiKey.length > 0;
  }
}

export const settings = new SettingsStore();