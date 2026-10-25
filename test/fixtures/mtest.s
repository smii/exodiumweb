# MTEST.COM: graphics mode 13h, limit the mouse to x 200..300, y 100..150
# (like an RTS minimap drag), wait ~4 s, then write "x y" to MOUSE.TXT.
.code16
.intel_syntax noprefix
.org 0
start:
  mov ax, 0x13
  int 0x10
  xor ax, ax
  int 0x33
  mov ax, 7
  mov cx, 200
  mov dx, 300
  int 0x33
  mov ax, 8
  mov cx, 100
  mov dx, 150
  int 0x33
  push ds
  xor ax, ax
  mov ds, ax
  mov bx, [0x46c]
  add bx, 72
wait_:
  mov ax, [0x46c]
  cmp ax, bx
  jb wait_
  pop ds
  mov ax, 3
  int 0x33
  mov di, offset buf + 0x100
  push dx
  mov ax, cx
  call dec
  mov byte ptr [di], ' '
  inc di
  pop ax
  call dec
  mov word ptr [di], 0x0a0d
  add di, 2
  mov ah, 0x3c
  xor cx, cx
  mov dx, offset fname + 0x100
  int 0x21
  mov bx, ax
  mov ah, 0x40
  mov cx, di
  sub cx, offset buf + 0x100
  mov dx, offset buf + 0x100
  int 0x21
  mov ah, 0x3e
  int 0x21
  mov ax, 3
  int 0x10
  ret
# ax -> decimal at [di], di advanced
dec:
  mov bx, 10
  xor cx, cx
d1:
  xor dx, dx
  div bx
  push dx
  inc cx
  test ax, ax
  jnz d1
d2:
  pop ax
  add al, '0'
  mov [di], al
  inc di
  loop d2
  ret
fname: .asciz "MOUSE.TXT"
buf: .space 32
