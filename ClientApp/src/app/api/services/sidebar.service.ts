import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {

  public sideBarOpen = signal<boolean>(false);
  
  constructor() { }

  toggleSideBar(){
    this.sideBarOpen.set(!this.sideBarOpen())
  }
}
