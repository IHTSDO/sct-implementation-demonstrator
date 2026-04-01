import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { AppMaterialModule } from '../../shared/app-material.module';
import { CdsHooksServerConfig, CdsHooksServerConfigService } from '../../services/cds-hooks-server-config.service';

@Component({
  selector: 'app-cds-hooks-servers-dialog',
  standalone: true,
  imports: [FormsModule, AppMaterialModule],
  template: `
    <div class="dialog-shell">
      <h2 mat-dialog-title>CDS Hooks Servers</h2>
      <mat-dialog-content>
        <p class="dialog-copy">
          Manage the CDS Hooks servers used by the medication decision support demo. Active servers are queried in parallel and results are shown grouped by server.
        </p>

        <div class="server-form">
          <mat-form-field appearance="outline">
            <mat-label>Server name</mat-label>
            <input matInput [(ngModel)]="draftName" name="draftName" placeholder="My CDS server" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Base URL</mat-label>
            <input matInput [(ngModel)]="draftBaseUrl" name="draftBaseUrl" placeholder="https://example.org" />
          </mat-form-field>

          <mat-slide-toggle [(ngModel)]="draftActive" name="draftActive">
            Active
          </mat-slide-toggle>

          <div class="form-actions">
            <button mat-button type="button" (click)="resetDraft()" *ngIf="editingServerId">Cancel edit</button>
            <button
              mat-flat-button
              color="primary"
              type="button"
              (click)="saveDraft()"
              [disabled]="!draftName.trim() || !draftBaseUrl.trim()">
              {{ editingServerId ? 'Update server' : 'Add server' }}
            </button>
          </div>
        </div>

        <div class="servers-list">
          @for (server of servers; track server.id) {
            <mat-card class="server-card" [class.server-card-inactive]="!server.active">
              <div class="server-card-header">
                <div class="server-card-copy">
                  <div class="server-card-title-row">
                    <strong>{{ server.name }}</strong>
                    @if (server.isDefault) {
                      <span class="server-badge">Default</span>
                    }
                    @if (!server.active) {
                      <span class="server-badge server-badge-muted">Inactive</span>
                    }
                  </div>
                  <div class="server-card-url">{{ server.baseUrl }}</div>
                </div>

                <mat-slide-toggle
                  [ngModel]="server.active"
                  (ngModelChange)="toggleServer(server.id, $event)"
                  [disabled]="!!server.isDefault && !server.active && activeServerCount <= 1">
                  Active
                </mat-slide-toggle>
              </div>

              <div class="server-card-actions">
                <button mat-button type="button" (click)="editServer(server)">Edit</button>
                <button
                  mat-button
                  color="warn"
                  type="button"
                  (click)="deleteServer(server.id)"
                  [disabled]="!!server.isDefault">
                  Delete
                </button>
              </div>
            </mat-card>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell {
      min-width: 620px;
      max-width: 760px;
    }

    .dialog-copy {
      color: #5f6b7a;
      margin: 0 0 18px;
      line-height: 1.5;
    }

    .server-form {
      display: grid;
      gap: 14px;
      padding: 16px;
      border: 1px solid #e6ebf2;
      border-radius: 12px;
      background: #f8fbff;
      margin-bottom: 18px;
    }

    .server-form mat-form-field {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .servers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .server-card {
      border-radius: 12px;
      box-shadow: none;
      border: 1px solid #e3e8ee;
    }

    .server-card-inactive {
      opacity: 0.75;
    }

    .server-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 16px 8px;
    }

    .server-card-copy {
      min-width: 0;
    }

    .server-card-title-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 4px;
    }

    .server-card-url {
      color: #6a7786;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-all;
    }

    .server-badge {
      padding: 3px 8px;
      border-radius: 999px;
      background: #ebf3ff;
      color: #265d9b;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .server-badge-muted {
      background: #eef2f6;
      color: #5f6b7a;
    }

    .server-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      padding: 0 8px 8px;
    }

    @media (max-width: 720px) {
      .dialog-shell {
        min-width: 0;
      }

      .server-card-header {
        flex-direction: column;
      }
    }
  `]
})
export class CdsHooksServersDialogComponent {
  servers: CdsHooksServerConfig[] = [];
  draftName = '';
  draftBaseUrl = '';
  draftActive = true;
  editingServerId: string | null = null;

  constructor(
    private cdsHooksServerConfigService: CdsHooksServerConfigService,
    private dialogRef: MatDialogRef<CdsHooksServersDialogComponent>
  ) {
    this.servers = this.cloneServers(this.cdsHooksServerConfigService.getServers());
  }

  get activeServerCount(): number {
    return this.servers.filter((server) => server.active).length;
  }

  close(): void {
    this.dialogRef.close();
  }

  editServer(server: CdsHooksServerConfig): void {
    this.editingServerId = server.id;
    this.draftName = server.name;
    this.draftBaseUrl = server.baseUrl;
    this.draftActive = server.active;
  }

  resetDraft(): void {
    this.editingServerId = null;
    this.draftName = '';
    this.draftBaseUrl = '';
    this.draftActive = true;
  }

  saveDraft(): void {
    const normalizedBaseUrl = this.normalizeBaseUrl(this.draftBaseUrl);
    if (!this.draftName.trim() || !normalizedBaseUrl) {
      return;
    }

    const duplicateServer = this.servers.find((server) =>
      server.baseUrl.toLowerCase() === normalizedBaseUrl.toLowerCase()
      && server.id !== this.editingServerId
    );
    if (duplicateServer) {
      this.editingServerId = duplicateServer.id;
    }

    if (this.editingServerId) {
      this.servers = this.servers.map((server) => {
        if (server.id !== this.editingServerId) {
          return server;
        }

        return {
          ...server,
          name: this.draftName.trim(),
          baseUrl: normalizedBaseUrl,
          active: this.draftActive
        };
      });
    } else {
      this.servers = [
        ...this.servers,
        {
          id: this.generateId(),
          name: this.draftName.trim(),
          baseUrl: normalizedBaseUrl,
          active: this.draftActive,
          isDefault: false
        }
      ];
    }

    this.persist();
    this.resetDraft();
  }

  toggleServer(serverId: string, active: boolean): void {
    this.servers = this.servers.map((server) => server.id === serverId ? { ...server, active } : server);
    this.persist();
  }

  deleteServer(serverId: string): void {
    const server = this.servers.find((entry) => entry.id === serverId);
    if (!server || server.isDefault) {
      return;
    }

    this.servers = this.servers.filter((entry) => entry.id !== serverId);
    this.persist();

    if (this.editingServerId === serverId) {
      this.resetDraft();
    }
  }

  private persist(): void {
    this.cdsHooksServerConfigService.saveServers(this.servers);
    this.servers = this.cloneServers(this.cdsHooksServerConfigService.getServers());
  }

  private cloneServers(servers: CdsHooksServerConfig[]): CdsHooksServerConfig[] {
    return servers.map((server) => ({ ...server }));
  }

  private normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/$/, '');
  }

  private generateId(): string {
    return 'cds-server-ui-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }
}
