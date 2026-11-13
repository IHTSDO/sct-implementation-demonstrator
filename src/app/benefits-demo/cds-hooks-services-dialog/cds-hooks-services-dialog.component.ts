import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AppMaterialModule } from '../../shared/app-material.module';
import { CdsHooksServerConfig, CdsHooksServerConfigService } from '../../services/cds-hooks-server-config.service';
import { CDSDiscoveryService, CdsService, STANDARD_HOOKS } from '../../services/cds.service';

export interface CdsHooksServicesDialogData {
  server: CdsHooksServerConfig;
}

interface ServiceGroup {
  hook: string;
  services: CDSDiscoveryService[];
}

/**
 * Lets the user choose which services of one CDS Hooks server the EHR calls. Disabled services are not
 * invoked at all (no POST), which is the standard CDS Hooks client-side choice after discovery.
 */
@Component({
  selector: 'app-cds-hooks-services-dialog',
  standalone: true,
  imports: [AppMaterialModule],
  template: `
    <div class="dialog-shell">
      <h2 mat-dialog-title>CDS services</h2>
      <mat-dialog-content>
        <div class="server-summary">
          <strong>{{ server.name }}</strong>
          <span class="server-url">{{ server.baseUrl }}</span>
        </div>
        <p class="dialog-copy">
          Choose which services from this server's discovery the EHR calls. Disabled services are not invoked.
          Changes apply the next time a hook runs, e.g. when a patient record is opened.
        </p>

        <div class="toolbar">
          <span class="summary">
            @if (!loading && !errorMessage) {
              {{ enabledCount }} of {{ services.length }} services enabled
            }
          </span>
          <button mat-button type="button" (click)="enableAll()" [disabled]="loading || !!errorMessage || services.length === 0">
            Enable all
          </button>
          <button mat-button type="button" (click)="disableAll()" [disabled]="loading || !!errorMessage || services.length === 0">
            Disable all
          </button>
          <button mat-icon-button type="button" (click)="load(true)" [disabled]="loading" matTooltip="Refresh discovery">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        @if (loading) {
          <div class="state">
            <mat-spinner diameter="28"></mat-spinner>
            <span>Loading discovery…</span>
          </div>
        } @else if (errorMessage) {
          <div class="state state-error">
            <mat-icon color="warn">error_outline</mat-icon>
            <span>Discovery failed: {{ errorMessage }}. The stored selection is unchanged.</span>
          </div>
        } @else if (services.length === 0) {
          <div class="state">This server does not offer any services.</div>
        } @else {
          @for (group of groups; track group.hook) {
            <section class="hook-group">
              <h3 class="hook-title">{{ group.hook }}</h3>
              @for (service of group.services; track service.id) {
                <div class="service-row" [class.service-disabled]="disabled.has(service.id)">
                  <mat-slide-toggle
                    color="primary"
                    [checked]="!disabled.has(service.id)"
                    (change)="setEnabled(service.id, $event.checked)"
                    [attr.aria-label]="'Enable ' + (service.title || service.id)">
                  </mat-slide-toggle>
                  <div class="service-copy">
                    <div class="service-title">
                      {{ service.title || service.id }}
                      <code class="service-id">{{ service.id }}</code>
                    </div>
                    @if (service.description) {
                      <div class="service-description">{{ service.description }}</div>
                    }
                    @if (prefetchEntries(service); as entries) {
                      @if (entries.length > 0) {
                        <div class="prefetch">
                          <span class="prefetch-label">Data requested</span>
                          @for (entry of entries; track entry[0]) {
                            <div class="prefetch-entry"><code>{{ entry[0] }}</code> → <code>{{ entry[1] }}</code></div>
                          }
                        </div>
                      }
                    }
                  </div>
                </div>
              }
            </section>
          }

          @if (notOfferedIds.length > 0) {
            <section class="hook-group">
              <h3 class="hook-title">Disabled, not currently offered</h3>
              <p class="dialog-copy">
                These services are disabled but no longer appear in discovery. They stay disabled if the server offers them again.
              </p>
              @for (id of notOfferedIds; track id) {
                <div class="service-row service-disabled">
                  <code class="service-id">{{ id }}</code>
                  <button mat-button type="button" (click)="setEnabled(id, true)">Forget</button>
                </div>
              }
            </section>
          }
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell {
      min-width: 620px;
      max-width: 820px;
    }

    .server-summary {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 8px;
    }

    .server-url {
      color: #6a7786;
      font-size: 13px;
      word-break: break-all;
    }

    .dialog-copy {
      color: #5f6b7a;
      margin: 0 0 12px;
      line-height: 1.5;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;
    }

    .summary {
      flex: 1;
      color: #5f6b7a;
      font-size: 13px;
    }

    .state {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 4px;
      color: #5f6b7a;
    }

    .hook-group {
      margin-bottom: 16px;
    }

    .hook-title {
      margin: 12px 0 8px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #5f6b7a;
      font-family: monospace;
    }

    .service-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border: 1px solid #e3e8ee;
      border-radius: 12px;
      margin-bottom: 8px;
    }

    .service-disabled .service-copy {
      opacity: 0.6;
    }

    .service-copy {
      min-width: 0;
      flex: 1;
    }

    .service-title {
      font-weight: 600;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
    }

    .service-id {
      font-size: 12px;
      font-weight: 400;
      color: #6a7786;
      word-break: break-all;
    }

    .service-description {
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-line;
    }

    .prefetch {
      margin-top: 8px;
      font-size: 12px;
      color: #5f6b7a;
    }

    .prefetch-label {
      display: block;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .prefetch-entry {
      word-break: break-all;
    }

    @media (max-width: 720px) {
      .dialog-shell {
        min-width: 0;
      }
    }
  `]
})
export class CdsHooksServicesDialogComponent implements OnInit, OnDestroy {
  readonly server: CdsHooksServerConfig;
  services: CDSDiscoveryService[] = [];
  groups: ServiceGroup[] = [];
  disabled = new Set<string>();
  notOfferedIds: string[] = [];
  loading = false;
  errorMessage: string | null = null;

  private subscription?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: CdsHooksServicesDialogData,
    private cdsService: CdsService,
    private cdsHooksServerConfigService: CdsHooksServerConfigService,
    private dialogRef: MatDialogRef<CdsHooksServicesDialogComponent>
  ) {
    this.server = data.server;
  }

  get enabledCount(): number {
    return this.services.filter((service) => !this.disabled.has(service.id)).length;
  }

  ngOnInit(): void {
    this.load(false);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  load(forceRefresh: boolean): void {
    this.subscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.disabled = this.cdsHooksServerConfigService.getDisabledServiceIds(this.server.id);

    this.subscription = this.cdsService.discoverSelectableServices(this.server.baseUrl, forceRefresh).subscribe((discovery) => {
      this.loading = false;
      if (discovery.failed) {
        this.errorMessage = discovery.errorMessage || 'unknown error';
        this.services = [];
        this.groups = [];
        this.notOfferedIds = [];
        return;
      }
      this.services = discovery.services;
      this.groups = this.groupByHook(discovery.services);
      this.updateNotOffered();
    });
  }

  setEnabled(serviceId: string, enabled: boolean): void {
    const next = new Set(this.disabled);
    if (enabled) {
      next.delete(serviceId);
    } else {
      next.add(serviceId);
    }
    this.persist(next);
  }

  enableAll(): void {
    // Keep ids that are not currently offered so they stay disabled if they come back.
    const offered = new Set(this.services.map((service) => service.id));
    this.persist(new Set(Array.from(this.disabled).filter((id) => !offered.has(id))));
  }

  disableAll(): void {
    this.persist(new Set([...this.disabled, ...this.services.map((service) => service.id)]));
  }

  prefetchEntries(service: CDSDiscoveryService): [string, string][] {
    const prefetch = service.prefetch;
    if (!prefetch || typeof prefetch !== 'object') {
      return [];
    }
    return Object.entries(prefetch).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  }

  close(): void {
    this.dialogRef.close();
  }

  private persist(disabled: Set<string>): void {
    this.cdsHooksServerConfigService.setDisabledServiceIds(this.server.id, disabled);
    this.disabled = this.cdsHooksServerConfigService.getDisabledServiceIds(this.server.id);
    this.updateNotOffered();
  }

  private updateNotOffered(): void {
    const offered = new Set(this.services.map((service) => service.id));
    this.notOfferedIds = Array.from(this.disabled).filter((id) => !offered.has(id)).sort();
  }

  private groupByHook(services: CDSDiscoveryService[]): ServiceGroup[] {
    const byHook = new Map<string, CDSDiscoveryService[]>();
    services.forEach((service) => {
      const hook = service.hook || 'unspecified';
      byHook.set(hook, [...(byHook.get(hook) || []), service]);
    });
    const order = (hook: string): number => {
      const index = (STANDARD_HOOKS as string[]).indexOf(hook);
      return index >= 0 ? index : STANDARD_HOOKS.length;
    };
    return Array.from(byHook.entries())
      .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
      .map(([hook, groupServices]) => ({ hook, services: groupServices }));
  }
}
