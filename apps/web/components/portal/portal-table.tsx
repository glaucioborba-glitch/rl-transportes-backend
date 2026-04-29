"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PortalTableColumn = { key: string; header: string; className?: string };

export function PortalTable<T>({
  columns,
  rows,
  getRowKey,
  renderCell,
  emptyText = "Nenhum registro",
}: {
  columns: PortalTableColumn[];
  rows: T[];
  getRowKey: (row: T) => string;
  renderCell: (row: T, key: string) => ReactNode;
  emptyText?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key} className={c.className}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((c) => (
                <TableCell key={c.key}>{renderCell(row, c.key)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
