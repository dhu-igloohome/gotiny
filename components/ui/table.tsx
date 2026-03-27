import type { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  const { className = "", ...rest } = props;
  return <table className={`w-full text-sm ${className}`} {...rest} />;
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  const { className = "", ...rest } = props;
  return <thead className={`bg-zinc-50 ${className}`} {...rest} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  const { className = "", ...rest } = props;
  return <tbody className={className} {...rest} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  const { className = "", ...rest } = props;
  return <tr className={`border-b border-zinc-200 ${className}`} {...rest} />;
}

export function TableCell(props: HTMLAttributes<HTMLTableCellElement>) {
  const { className = "", ...rest } = props;
  return <td className={`px-3 py-2 text-zinc-700 ${className}`} {...rest} />;
}

export function TableHeaderCell(props: HTMLAttributes<HTMLTableCellElement>) {
  const { className = "", ...rest } = props;
  return <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 ${className}`} {...rest} />;
}
