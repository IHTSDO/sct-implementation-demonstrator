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
  private static readonly DISABLED_SERVICES_STORAGE_KEY = 'cdsHooksDisabledServices';
  private disabledServices: Record<string, string[]> = {};
  private readonly serversSubject = new BehaviorSubject<CdsHooksServerConfig[]>([CdsHooksServerConfigService.DEFAULT_SERVER]);
  readonly servers$ = this.serversSubject.asObservable();

  constructor(private storageService: StorageService) {
    this.initialize();
    this.disabledServices = this.readDisabledServices();
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
    this.pruneDisabledServices(normalizedServers);
  }

  /**
   * Service ids the user switched off for a server. Disabled ids are stored (not enabled ones) so that
   * services appearing later in discovery are enabled by default.
   */
  getDisabledServiceIds(serverId: string): Set<string> {
    return new Set(this.disabledServices[serverId] || []);
  }

  setDisabledServiceIds(serverId: string, serviceIds: Iterable<string>): void {
    const ids = Array.from(new Set(serviceIds)).filter((id) => typeof id === 'string' && id.length > 0).sort();
    const next = { ...this.disabledServices };
    if (ids.length > 0) {
      next[serverId] = ids;
    } else {
      delete next[serverId];
    }
    this.writeDisabledServices(next);
  }

  private pruneDisabledServices(servers: CdsHooksServerConfig[]): void {
    const serverIds = new Set(servers.map((server) => server.id));
    const staleIds = Object.keys(this.disabledServices).filter((serverId) => !serverIds.has(serverId));
    if (staleIds.length === 0) {
      return;
    }
    const next = { ...this.disabledServices };
    staleIds.forEach((serverId) => delete next[serverId]);
    this.writeDisabledServices(next);
  }

  private readDisabledServices(): Record<string, string[]> {
    try {
      if (!this.storageService.isLocalStorageSupported()) {
        return {};
      }
      const rawValue = this.storageService.getItem(CdsHooksServerConfigService.DISABLED_SERVICES_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : null;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const result: Record<string, string[]> = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([serverId, ids]) => {
        if (Array.isArray(ids)) {
          const validIds = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
          if (validIds.length > 0) {
            result[serverId] = validIds;
          }
        }
      });
      return result;
    } catch {
      return {};
    }
  }

  private writeDisabledServices(value: Record<string, string[]>): void {
    this.disabledServices = value;
    try {
      if (this.storageService.isLocalStorageSupported()) {
        this.storageService.saveItem(CdsHooksServerConfigService.DISABLED_SERVICES_STORAGE_KEY, JSON.stringify(value));
      }
    } catch {
      // Keep the in-memory selection when storage is unavailable.
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
