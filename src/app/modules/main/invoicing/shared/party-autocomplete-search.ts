import { MatAutocomplete } from '@angular/material/autocomplete';
import { lastValueFrom } from 'rxjs';
import { PartiesService, Party, PartyType } from '../services/parties.service';

const PAGE_SIZE = 20;

/** Paginated party picker with search + infinite scroll in autocomplete panel. */
export class PartyAutocompleteSearch {
    items: Party[] = [];
    loading = false;
    loadingMore = false;
    hasMore = true;

    private _page = 1;
    private _total = 0;
    private _searchQuery = '';
    private _companyId: string | null = null;
    private _typeFilter: PartyType | null = null;
    private _loadToken = 0;
    private _panelEl: HTMLElement | null = null;
    private _scrollHandler: (() => void) | null = null;

    constructor(private _partiesService: PartiesService) {}

    get isEmpty(): boolean {
        return !this.loading && this.items.length === 0;
    }

    async resetAndLoad(searchQuery = '', force = false): Promise<void> {
        const q = searchQuery.trim();
        if (
            !force &&
            q === this._searchQuery &&
            this._page === 1 &&
            (this.loading || this.items.length > 0)
        ) {
            return;
        }
        this._searchQuery = q;
        this._page = 1;
        this.hasMore = true;
        this.items = [];
        await this._fetchPage(true);
    }

    setCompanyId(companyId: string | null | undefined): void {
        this._companyId = companyId?.trim() || null;
    }

    setTypeFilter(type: PartyType | null | undefined): void {
        this._typeFilter = type ?? null;
    }

    async loadMore(): Promise<void> {
        if (!this.hasMore || this.loading || this.loadingMore) return;
        this._page += 1;
        await this._fetchPage(false);
    }

    ensureInList(party: Party): void {
        if (!this.items.some((p) => p.id === party.id)) {
            this.items = [party, ...this.items];
        }
    }

    bindPanelScroll(autocomplete: MatAutocomplete): void {
        setTimeout(() => {
            const panel = autocomplete.panel?.nativeElement as HTMLElement | undefined;
            if (!panel) return;
            this.unbindPanelScroll();
            this._panelEl = panel;
            this._scrollHandler = () => {
                if (!this._panelEl || this.loading || this.loadingMore || !this.hasMore) return;
                const el = this._panelEl;
                if (el.scrollHeight <= el.clientHeight + 1) return;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
                    void this.loadMore();
                }
            };
            panel.addEventListener('scroll', this._scrollHandler, { passive: true });
            void this._fillPanelIfNeeded();
        });
    }

    private async _fillPanelIfNeeded(): Promise<void> {
        let guard = 0;
        while (
            this._panelEl &&
            this.hasMore &&
            !this.loading &&
            !this.loadingMore &&
            guard < 10
        ) {
            const el = this._panelEl;
            if (el.scrollHeight > el.clientHeight + 1) break;
            guard += 1;
            await this.loadMore();
        }
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
            const resp = await lastValueFrom(
                this._partiesService.getParties(this._page, PAGE_SIZE, {
                    search: this._searchQuery || null,
                    companyId: this._companyId,
                    type: this._typeFilter,
                })
            );
            if (token !== this._loadToken) return;
            const batch = resp.data ?? [];
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

    private _mergeById(existing: Party[], batch: Party[]): Party[] {
        const ids = new Set(existing.map((p) => p.id));
        const merged = [...existing];
        for (const p of batch) {
            if (!ids.has(p.id)) {
                merged.push(p);
                ids.add(p.id);
            }
        }
        return merged;
    }
}
