import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

export interface TalabatOccupationRate {
    id: string;
    occupation: string;
    pickupRateAed: number;
    dropoffRateAed: number;
    deliveriesReturnLcRateAed: number;
    updatedAt: string;
}

export interface TalabatOccupationRatesListResponse {
    items: TalabatOccupationRate[];
}

export interface TalabatOccupationRatePayload {
    occupation: string;
    pickupRateAed: number;
    dropoffRateAed: number;
    deliveriesReturnLcRateAed: number;
}

@Injectable({ providedIn: 'root' })
export class TalabatOccupationRatesService {
    private _http = inject(HttpClient);
    private _base = `${environment.apiUrl}talabat-occupation-rates`;

    getRates(): Observable<TalabatOccupationRatesListResponse> {
        return this._http.get<TalabatOccupationRatesListResponse>(this._base);
    }

    updateRate(payload: TalabatOccupationRatePayload): Observable<unknown> {
        return this._http.put(this._base, payload);
    }
}
