import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";
import { SaveStatus } from "../SaveStatus";

export const MainLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
    <Sidebar />
    <BottomBar />
    <main className="layout-main flex-1 overflow-auto">{children}</main>
    <SaveStatus />
  </div>
);
