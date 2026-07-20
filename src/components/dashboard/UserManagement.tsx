import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserCheck, UserX, Clock, MapPin, Phone, Mail, Trash2 } from 'lucide-react';
import { useUserApproval } from '@/hooks/useUserApproval';

const UserManagement = () => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('pending');
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    user_id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    location: string | null;
    approval_status: string;
    rejection_reason: string | null;
    created_at: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { users, loading, actionLoading, fetchUsers, approveUser, rejectUser, deleteUser } = useUserApproval();

  useEffect(() => {
    fetchUsers(filter);
  }, [filter, fetchUsers]);



  const handleApproveUser = async (userId: string) => {
    const success = await approveUser(userId);
    if (success) {
      fetchUsers(filter);
    }
  };

  const handleRejectUser = async (userId: string, reason: string) => {
    const success = await rejectUser(userId, reason);
    if (success) {
      setSelectedUser(null);
      setRejectionReason('');
      fetchUsers(filter);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
      case 'active':
        return <Badge variant="outline" className="text-green-600 border-green-600"><UserCheck className="w-3 h-3 mr-1" />Aktif</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-red-600 border-red-600"><UserX className="w-3 h-3 mr-1" />Nonaktif</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus user ${userName}? Tindakan ini tidak dapat dibatalkan.`)) {
      const success = await deleteUser(userId);
      if (success) {
        fetchUsers(filter);
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kelola Pengguna Nelayan</CardTitle>
          <CardDescription>Setujui atau tolak pendaftaran nelayan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Memuat data pengguna...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kelola Pengguna Nelayan</CardTitle>
        <CardDescription>Setujui atau tolak pendaftaran nelayan</CardDescription>
        
        {/* Filter Buttons */}
        <div className="flex gap-2 mt-4">
          <Button 
            variant={filter === 'pending' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('pending')}
          >
            <Clock className="w-4 h-4 mr-1" />
            Menunggu ({users.filter(u => u.approval_status === 'pending').length})
          </Button>
          <Button 
            variant={filter === 'active' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('active')}
          >
            <UserCheck className="w-4 h-4 mr-1" />
            Aktif
          </Button>
          <Button 
            variant={filter === 'inactive' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('inactive')}
          >
            <UserX className="w-4 h-4 mr-1" />
            Nonaktif
          </Button>
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
          >
            Semua
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada pengguna {filter === 'all' ? '' : filter} ditemukan.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Daftar</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-1 text-gray-400" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.phone ? (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-1 text-gray-400" />
                        {user.phone}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.location ? (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {user.location}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    {user.approval_status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveUser(user.user_id)}
                          disabled={actionLoading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Setujui
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setSelectedUser(user)}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Tolak
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Tolak Pendaftaran Nelayan</DialogTitle>
                              <DialogDescription>
                                Anda akan menolak pendaftaran {user.full_name}. Berikan alasan penolakan.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="reason">Alasan Penolakan</Label>
                                <Textarea
                                  id="reason"
                                  placeholder="Masukkan alasan penolakan..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(null);
                                  setRejectionReason('');
                                }}
                              >
                                Batal
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => selectedUser && handleRejectUser(selectedUser.user_id, rejectionReason)}
                                disabled={!rejectionReason.trim() || actionLoading}
                              >
                                {actionLoading ? 'Memproses...' : 'Tolak Pengguna'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                    {user.approval_status === 'active' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.user_id, user.full_name || user.email)}
                        disabled={actionLoading}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Hapus
                      </Button>
                    )}
                    {user.approval_status === 'inactive' && user.rejection_reason && (
                      <div className="text-sm text-red-600">
                        Alasan: {user.rejection_reason}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManagement;