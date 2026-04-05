import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class GlobalService {

  constructor(private _http: HttpClient, private dialog: MatDialog) {}

  uploadFile<T>(file: File, extraData?: Record<string, any>): Observable<T> {
    if (!file) {
      throw new Error('File is required');
    }

    const formData = new FormData();
    formData.append('file', file);

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        if (extraData[key] !== null && extraData[key] !== undefined) {
          formData.append(key, extraData[key]);
        }
      });
    }
    return this._http.post<T>(`${environment.apiUrl}FileUpload/single`, formData);
  }

  uploadMultipleFiles<T>(files: File[], extraData?: Record<string, any>): Observable<T> {
    if (!files || files.length === 0) {
      throw new Error('Files are required');
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    if (extraData) {
      Object.keys(extraData).forEach(key => {
        if (extraData[key] !== null && extraData[key] !== undefined) {
          formData.append(key, extraData[key]);
        }
      });
    }
    return this._http.post<T>(`${environment.apiUrl}FileUpload/multiple`, formData);
  }

  getCompanyTypes(){
    return this._http.get(`${environment.apiUrl}CompanyType`);
  }

  confirmDialog(data: any): Observable<any | undefined> {
    return this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        disableClose: true,
        data
      })
      .afterClosed();
  }

  
}
