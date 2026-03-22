"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { IconButton } from "./icon-button";
import { XIcon } from "./icons";
import { ModalOverlay } from "./modal-overlay";

type ModalFrameProps = {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ModalFrame({
  title,
  description,
  closeLabel,
  onClose,
  children,
  className,
  bodyClassName
}: ModalFrameProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <Card
        className={cn(
          "panel relative w-full max-w-5xl overflow-hidden border-transparent px-0 py-0",
          className
        )}
      >
        <IconButton
          icon={<XIcon />}
          label={closeLabel}
          variant="ghost"
          onClick={onClose}
          className="absolute end-4 top-4 z-10"
        />

        <CardHeader className="border-b border-border/80 px-5 py-5 pe-16 sm:px-6 sm:py-6 sm:pe-20">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>

        <CardContent
          className={cn(
            "mt-0 max-h-[calc(92vh-5.75rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6",
            bodyClassName
          )}
        >
          {children}
        </CardContent>
      </Card>
    </ModalOverlay>
  );
}
