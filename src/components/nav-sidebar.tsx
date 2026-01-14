"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  RotateCcw,
  FileText,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  FolderTree,
  Zap,
  Package,
  Scale,
  Target,
  Wallet,
  Plug,
  BrainCircuit,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ModeToggle } from "@/components/mode-toggle"

const data = {
  user: {
    name: "Legion Partner",
    email: "partner@legiongrappling.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: Receipt,
    },
    {
      title: "Pending Approvals",
      url: "/reconciliation/pending",
      icon: Zap,
    },
    {
      title: "Categories",
      url: "/categories",
      icon: FolderTree,
    },
    {
      title: "Budget",
      url: "/budget",
      icon: Target,
    },
    {
      title: "Cash Flow",
      url: "/cash-flow",
      icon: Wallet,
    },
    {
      title: "Accounts Payable",
      url: "/accounts-payable",
      icon: FileText,
    },
    {
      title: "Bills",
      url: "/bills",
      icon: RotateCcw,
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: FileText,
    },
    {
      title: "Vendors",
      url: "/vendors",
      icon: Building2,
    },
    {
      title: "Staff",
      url: "/staff",
      icon: Users,
    },
    {
      title: "Debt Management",
      url: "/debts",
      icon: CreditCard,
    },
    {
      title: "Creditors",
      url: "/creditors",
      icon: Building2,
    },
    {
      title: "Asset Register",
      url: "/assets",
      icon: Package,
    },
    {
      title: "Financial Reports",
      url: "/reports",
      icon: BarChart3,
    },
    {
      title: "Balance Sheet",
      url: "/balance-sheet",
      icon: Scale,
    },
    {
      title: "Mindbody Intelligence",
      url: "/mindbody",
      icon: BrainCircuit,
    },
  ],
  footer: [
    {
      title: "Integrations",
      url: "/settings/integrations",
      icon: Plug,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ],
}

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="h-16 border-b border-sidebar-border px-6 flex flex-row items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
          L
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm leading-none">Legion Finance</span>
        </div>
        <div className="ml-auto">
          <ModeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-6">
        <SidebarMenu>
          {data.navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
                className="hover:bg-sidebar-accent transition-colors py-5"
              >
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          {data.footer.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton id="user-profile-trigger" className="h-12 w-full justify-start gap-3 mt-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">LP</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start truncate overflow-hidden">
                    <span className="text-sm font-semibold truncate w-full">{data.user.name}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">{data.user.email}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width]"
                side="top"
                align="start"
              >
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
