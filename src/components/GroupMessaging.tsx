'use client';

import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { Send, Smile, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import type { GroupWithStats } from '../types/groups';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface GroupMessagingProps {
  group: GroupWithStats;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
}

export function GroupMessaging({ group, messages: initialMessages, onSendMessage }: GroupMessagingProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`group-${group.id}`);
    channel.bind('new-message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
    });

    return () => {
      pusher.unsubscribe(`group-${group.id}`);
    };
  }, [group.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSend = async () => {
    if (newMessage.trim() && !isSending) {
      setIsSending(true);
      try {
        await onSendMessage(newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const getInitials = (text: string) => {
    const words = text.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const isCurrentUser = (senderId: string) => {
    return group.createdById === senderId;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {getInitials(group.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{group.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {group.members.length} members
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mute notifications</DropdownMenuItem>
              <DropdownMenuItem>Search messages</DropdownMenuItem>
              <DropdownMenuItem>View members</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {[...messages].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ).map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-3 ${
                  isCurrentUser(message.sender.id) ? 'justify-end' : ''
                }`}
              >
                {!isCurrentUser(message.sender.id) && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10">
                      {getUserInitials(message.sender.firstName, message.sender.lastName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[70%] ${
                    isCurrentUser(message.sender.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  } p-3 rounded-lg`}
                >
                  {!isCurrentUser(message.sender.id) && (
                    <p className="text-sm font-medium mb-1">
                      {`${message.sender.firstName} ${message.sender.lastName}`}
                    </p>
                  )}
                  <p className="break-words">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="pr-24"
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={isSending}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4 z-50">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}