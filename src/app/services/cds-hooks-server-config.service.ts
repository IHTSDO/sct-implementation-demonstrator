import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

export interface CdsHooksServerConfig {
  id: string;
  name: string;
  baseUrl: string;
  active: boolean;
  isDefault?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CdsHooksServerConfigService {
  static readonly DEFAULT_SERVER: CdsHooksServerConfig = {
    id: 'default-demo-cds-server',
    name: 'SNOMED Demo CDS Server',
    baseUrl: 'https://implementation-demo.snomedtools.org',
    active: true,
    isDefault: true
  };

  private static readonly STORAGE_KEY = 'cdsHooksServers';
  private readonly serversSubject = new BehaviorSubject<CdsHooksServerConfig[]>([CdsHooksServerConfigService.DEFAULT_SERVER]);
  readonly servers$ = this.serversSubject.asObservable();

  constructor(private storageService: StorageService) {
    this.initialize();
  }

  getServers(): CdsHooksServerConfig[] {
    return this.serversSubject.getValue();
  }

  getActiveServers(): CdsHooksServerConfig[] {
    return this.getServers().filter((server) => server.active);
  }

  saveServers(servers: CdsHooksServerConfig[]): void {
    const normalizedServers = this.normalizeServerList(servers);
    this.serversSubject.next(normalizedServers);
    if (this.storageService.isLocalStorageSupported()) {
      this.storageService.saveItem(CdsHooksServerConfigService.STORAGE_KEY, JSON.stringify(normalizedServers));
    }
  }

  private initialize(): void {
    if (!this.storageService.isLocalStorageSupported()) {
      this.serversSubject.next([CdsHooksServerConfigService.DEFAULT_SERVER]);
      return;
    }

    const rawValue = this.storageService.getItem(CdsHooksServerConfigService.STORAGE_KEY);
    if (!rawValue) {
      this.saveServers([CdsHooksServerConfigService.DEFAULT_SERVER]);
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        this.saveServers([CdsHooksServerConfigService.DEFAULT_SERVER]);
        return;
      }

      const normalized = this.normalizeServerList(parsed);
      this.serversSubject.next(normalized);
    } catch {
      this.saveServers([CdsHooksServerConfigService.DEFAULT_SERVER]);
    }
  }

  private normalizeServerList(rawServers: unknown[]): CdsHooksServerConfig[] {
    const normalizedDefault = this.normalizeServer(CdsHooksServerConfigService.DEFAULT_SERVER) || {
      ...CdsHooksServerConfigService.DEFAULT_SERVER
    };
    const deduplicated = new Map<string, CdsHooksServerConfig>();

    rawServers.forEach((rawServer) => {
      const normalized = this.normalizeServer(rawServer);
      if (!normalized) {
        return;
      }

      const dedupeKey = normalized.baseUrl.toLowerCase();
      if (!deduplicated.has(dedupeKey)) {
        deduplicated.set(dedupeKey, normalized);
      }
    });

    const normalizedServers = Array.from(deduplicated.values());
    const defaultIndex = normalizedServers.findIndex((server) => server.id === normalizedDefault.id || server.baseUrl === normalizedDefault.baseUrl);

    if (defaultIndex >= 0) {
      normalizedServers[defaultIndex] = {
        ...normalizedServers[defaultIndex],
        id: normalizedDefault.id,
        name: normalizedServers[defaultIndex].name || normalizedDefault.name,
        baseUrl: normalizedDefault.baseUrl,
        isDefault: true
      };
    } else {
      normalizedServers.unshift(normalizedDefault);
    }

    return normalizedServers;
  }

  private normalizeServer(rawServer: unknown): CdsHooksServerConfig | null {
    if (!rawServer || typeof rawServer !== 'object') {
      return null;
    }

    const candidate = rawServer as Partial<CdsHooksServerConfig>;
    const baseUrl = this.normalizeBaseUrl(candidate.baseUrl);
    if (!baseUrl) {
      return null;
    }

    const isDefault = baseUrl === CdsHooksServerConfigService.DEFAULT_SERVER.baseUrl;
    return {
      id: candidate.id?.trim() || this.generateId(),
      name: candidate.name?.trim() || baseUrl,
      baseUrl,
      active: candidate.active !== false,
      isDefault
    };
  }

  private normalizeBaseUrl(url?: string): string {
    return String(url || '').trim().replace(/\/$/, '');
  }

  private generateId(): string {
    return 'cds-server-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }
}
