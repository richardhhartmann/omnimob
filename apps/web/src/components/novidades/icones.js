import {
  ArrowsDownUp, ArrowsLeftRight, Bell, Buildings, Calculator, CalendarCheck, ChartBar, ChartLineUp, ChatsCircle, ClipboardText,
  Coins, CreditCard, Desktop, DeviceMobile, Envelope, Eye, FileText, Funnel, Gauge, Gear, GoogleLogo, GridFour, HandCoins,
  Handshake, House, Kanban, Key, Lifebuoy, Lightning, ListChecks, MagnifyingGlass, MapPin, Megaphone, Notebook, PaintBrush,
  Plugs, Robot, Scroll, ShieldCheck, Signature, SlidersHorizontal, Sparkle, Star, Storefront, Tag, TrendUp, UserFocus, UserPlus,
  Users, UsersThree, Wallet, WhatsappLogo, Wrench,
} from "@phosphor-icons/react";
import { createElement } from "react";

/* Os ícones que o conteúdo das Novidades pode usar (pelo nome do Phosphor).
   Lista FECHADA de propósito: importar a biblioteca inteira pesaria no painel.
   A rotina que escreve o rascunho recebe esta lista (docs/novidades/AGENDAMENTO.md);
   nome fora dela vira Sparkle. */
export const ICONES = {
  ArrowsDownUp, ArrowsLeftRight, Bell, Buildings, Calculator, CalendarCheck, ChartBar, ChartLineUp, ChatsCircle, ClipboardText,
  Coins, CreditCard, Desktop, DeviceMobile, Envelope, Eye, FileText, Funnel, Gauge, Gear, GoogleLogo, GridFour, HandCoins,
  Handshake, House, Kanban, Key, Lifebuoy, Lightning, ListChecks, MagnifyingGlass, MapPin, Megaphone, Notebook, PaintBrush,
  Plugs, Robot, Scroll, ShieldCheck, Signature, SlidersHorizontal, Sparkle, Star, Storefront, Tag, TrendUp, UserFocus, UserPlus,
  Users, UsersThree, Wallet, WhatsappLogo, Wrench,
};

export const iconeDe = (nome) => ICONES[nome] ?? Sparkle;

/** O ícone pelo nome, já desenhado (sem criar componente durante a renderização). */
export const desenharIcone = (nome, props) => createElement(iconeDe(nome), props);
