import { MatAutocomplete } from '@angular/material/autocomplete';
import { lastValueFrom } from 'rxjs';
import { EmployeesService, EmployeeListItem } from './employees.service';

const PAGE_SIZE = 20;

/** Paginated employee picker: API `name` search + infinite scroll in autocomplete panel. */
export class EmployeeAutocompleteSearch {
    items: EmployeeListItem[] = [];
    loading = false;
    loadingMore = false;
    hasMore = true;

    private _page = 1;
    private _total = 0;
    private _nameQuery = '';
    private _loadToken = 0;
    private _panelEl: HTMLElement | null = null;
    private _scrollHandler: (() => void) | null = null;

    constructor(private _employeesService: EmployeesService) {}

    get isEmpty(): boolean {
        return !this.loading && this.items.length === 0;
    }

    async resetAndLoad(nameQuery = ''): Promise<void> {
        this._nameQuery = nameQuery.trim();
        this._page = 1;
        this.hasMore = true;
        this.items = [];
        await this._fetchPage(true);
    }

    async loadMore(): Promise<void> {
        if (!this.hasMore || this.loading || this.loadingMore) return;
        this._page += 1;
        await this._fetchPage(false);
    }

    ensureInList(employee: EmployeeListItem): void {
        if (!this.items.some((e) => e.id === employee.id)) {
            this.items = [employee, ...this.items];
        }
    }

    bindPanelScroll(autocomplete: MatAutocomplete): void {
        setTimeout(() => {
            const panel = autocomplete.panel?.nativeElement as HTMLElement | undefined;
            if (!panel) return;
            this.unbindPanelScroll();
            this._panelEl = panel;
            this._scrollHandler = () => {
                if (!this._panelEl) return;
                const el = this._panelEl;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
                    void this.loadMore();
                }
            };
            panel.addEventListener('scroll', this._scrollHandler, { passive: true });
        });
    }

    unbindPanelScroll(): void {
        if (this._panelEl && this._scrollHandler) {
            this._panelEl.removeEventListener('scroll', this._scrollHandler);
        }
        this._panelEl = null;
        this._scrollHandler = null;
    }

    private async _fetchPage(replace: boolean): Promise<void> {
        const token = ++this._loadToken;
        if (replace) {
            this.loading = true;
        } else {
            this.loadingMore = true;
        }
        try {
            const q = this._nameQuery;
            const filters: { name?: string | null; employeeId?: string | null } = {};
            if (q) {
                if (/[A-Za-z0-9]-/.test(q)) {
                    filters.employeeId = q;
                } else {
                    filters.name = q;
                }
            }
            const resp = await lastValueFrom(
                this._employeesService.getEmployees(this._page, PAGE_SIZE, filters)
            );
            if (token !== this._loadToken) return;
            const batch = resp.employees ?? [];
            this._total = resp.count ?? batch.length;
            this.items = replace ? batch : this._mergeById(this.items, batch);
            this.hasMore = this.items.length < this._total;
        } catch {
            if (token !== this._loadToken) return;
            if (replace) this.items = [];
            this.hasMore = false;
        } finally {
            if (token === this._loadToken) {
                this.loading = false;
                this.loadingMore = false;
            }
        }
    }

    private _mergeById(existing: EmployeeListItem[], batch: EmployeeListItem[]): EmployeeListItem[] {
        const ids = new Set(existing.map((e) => e.id));
        const merged = [...existing];
        for (const e of batch) {
            if (!ids.has(e.id)) {
                merged.push(e);
                ids.add(e.id);
            }
        }
        return merged;
    }
}
