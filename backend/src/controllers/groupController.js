
const Group = require('../models/Group');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { cloudinary } = require('../utils/cloudinary');

class GroupController {
    // Create group
    async createGroup(req, res) {
        try {
            const userId = req.userId;
            const { name, description, privacy, tags } = req.body;

            // Check if group name exists
            const existingGroup = await Group.findOne({ 
                name: new RegExp(`^${name}$`, 'i') 
            });

            if (existingGroup) {
                return res.status(400).json({
                    success: false,
                    error: 'يوجد مجموعة بنفس الاسم بالفعل'
                });
            }

            const user = await User.findById(userId);

            // Handle cover photo upload
            let coverPhoto = null;
            let icon = null;

            if (req.files) {
                if (req.files.coverPhoto) {
                    const coverResult = await cloudinary.uploader.upload(
                        req.files.coverPhoto[0].path,
                        {
                            folder: `nexus/groups/covers`,
                            transformation: [
                                { width: 1500, height: 500, crop: 'fill' }
                            ]
                        }
                    );
                    coverPhoto = coverResult.secure_url;
                }

                if (req.files.icon) {
                    const iconResult = await cloudinary.uploader.upload(
                        req.files.icon[0].path,
                        {
                            folder: `nexus/groups/icons`,
                            transformation: [
                                { width: 200, height: 200, crop: 'fill' }
                            ]
                        }
                    );
                    icon = iconResult.secure_url;
                }
            }

            const group = new Group({
                name,
                description,
                admin: userId,
                members: [{
                    user: userId,
                    role: 'admin',
                    joinedAt: new Date()
                }],
                privacy: privacy || 'public',
                coverPhoto: coverPhoto || 'https://res.cloudinary.com/nexus/image/upload/v1/defaults/group_cover.jpg',
                icon: icon || 'https://res.cloudinary.com/nexus/image/upload/v1/defaults/group_icon.png',
                tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
                memberCount: 1
            });

            await group.save();

            res.status(201).json({
                success: true,
                message: 'تم إنشاء المجموعة بنجاح',
                data: group
            });

        } catch (error) {
            console.error('Create group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إنشاء المجموعة'
            });
        }
    }

    // Get user's groups
    async getUserGroups(req, res) {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20, type = 'member' } = req.query;
            const skip = (page - 1) * limit;

            let query = {};

            if (type === 'admin') {
                query = { admin: userId };
            } else if (type === 'moderator') {
                query = { 'moderators.user': userId };
            } else {
                query = { 'members.user': userId };
            }

            const groups = await Group.find(query)
                .populate('admin', 'username profile')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Group.countDocuments(query);

            // Add user role in each group
            const groupsWithRole = await Promise.all(
                groups.map(async (group) => {
                    const member = group.members.find(m => m.user.equals(userId));
                    return {
                        ...group.toObject(),
                        userRole: member ? member.role : null,
                        isAdmin: group.admin.equals(userId),
                        isModerator: group.moderators.some(m => m.user.equals(userId))
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    groups: groupsWithRole,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get user groups error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب المجموعات'
            });
        }
    }

    // Get group details
    async getGroup(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const group = await Group.findById(id)
                .populate('admin', 'username profile')
                .populate('moderators.user', 'username profile')
                .populate('members.user', 'username profile');

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check privacy
            const user = await User.findById(userId);
            if (group.privacy === 'secret' && 
                !group.members.some(m => m.user.equals(userId))) {
                return res.status(403).json({
                    success: false,
                    error: 'المجموعة سرية'
                });
            }

            // Add user membership info
            const member = group.members.find(m => m.user.equals(userId));
            const membershipRequest = group.membershipRequests.find(
                req => req.user.equals(userId) && req.status === 'pending'
            );

            const groupData = {
                ...group.toObject(),
                isMember: !!member,
                userRole: member ? member.role : null,
                membershipStatus: member ? member.status : null,
                hasPendingRequest: !!membershipRequest,
                canJoin: group.privacy === 'public' || 
                        (group.privacy === 'private' && !member),
                canPost: member && (member.role === 'admin' || 
                        member.role === 'moderator' || 
                        group.settings.allowMemberPosts)
            };

            res.json({
                success: true,
                data: groupData
            });

        } catch (error) {
            console.error('Get group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب بيانات المجموعة'
            });
        }
    }

    // Update group
    async updateGroup(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const updates = req.body;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتعديل المجموعة'
                });
            }

            // Handle cover photo upload
            if (req.files && req.files.coverPhoto) {
                const file = req.files.coverPhoto[0];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `nexus/groups/covers`,
                    transformation: [
                        { width: 1500, height: 500, crop: 'fill' }
                    ]
                });

                // Delete old cover photo if exists
                if (group.coverPhoto && !group.coverPhoto.includes('default')) {
                    const oldPublicId = group.coverPhoto
                        .split('/')
                        .slice(-2)
                        .join('/')
                        .split('.')[0];
                    
                    await cloudinary.uploader.destroy(oldPublicId);
                }

                updates.coverPhoto = result.secure_url;
            }

            // Handle icon upload
            if (req.files && req.files.icon) {
                const file = req.files.icon[0];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `nexus/groups/icons`,
                    transformation: [
                        { width: 200, height: 200, crop: 'fill' }
                    ]
                });

                // Delete old icon if exists
                if (group.icon && !group.icon.includes('default')) {
                    const oldPublicId = group.icon
                        .split('/')
                        .slice(-2)
                        .join('/')
                        .split('.')[0];
                    
                    await cloudinary.uploader.destroy(oldPublicId);
                }

                updates.icon = result.secure_url;
            }

            // Update group
            Object.keys(updates).forEach(key => {
                group[key] = updates[key];
            });

            await group.save();

            const updatedGroup = await Group.findById(id)
                .populate('admin', 'username profile');

            res.json({
                success: true,
                message: 'تم تحديث المجموعة بنجاح',
                data: updatedGroup
            });

        } catch (error) {
            console.error('Update group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تحديث المجموعة'
            });
        }
    }

    // Delete group
    async deleteGroup(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check if user is admin
            if (!group.admin.equals(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لحذف المجموعة'
                });
            }

            // Delete group posts
            await Post.deleteMany({ group: id });

            // Delete group files from cloudinary
            if (group.coverPhoto && !group.coverPhoto.includes('default')) {
                const coverPublicId = group.coverPhoto
                    .split('/')
                    .slice(-2)
                    .join('/')
                    .split('.')[0];
                
                await cloudinary.uploader.destroy(coverPublicId);
            }

            if (group.icon && !group.icon.includes('default')) {
                const iconPublicId = group.icon
                    .split('/')
                    .slice(-2)
                    .join('/')
                    .split('.')[0];
                
                await cloudinary.uploader.destroy(iconPublicId);
            }

            await Group.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'تم حذف المجموعة بنجاح'
            });

        } catch (error) {
            console.error('Delete group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حذف المجموعة'
            });
        }
    }

    // Join group
    async joinGroup(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const group = await Group.findById(id);
            const user = await User.findById(userId);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check if already member
            const isMember = group.members.some(m => m.user.equals(userId));
            if (isMember) {
                return res.status(400).json({
                    success: false,
                    error: 'أنت عضو بالفعل في هذه المجموعة'
                });
            }

            // Check if banned
            const isBanned = group.members.some(m => 
                m.user.equals(userId) && m.status === 'banned'
            );
            if (isBanned) {
                return res.status(403).json({
                    success: false,
                    error: 'أنت محظور من هذه المجموعة'
                });
            }

            // Check if already requested
            const hasPendingRequest = group.membershipRequests.some(
                req => req.user.equals(userId) && req.status === 'pending'
            );
            if (hasPendingRequest) {
                return res.status(400).json({
                    success: false,
                    error: 'لديك طلب انضمام معلق بالفعل'
                });
            }

            let message;
            if (group.privacy === 'public') {
                // Auto-join public groups
                group.members.push({
                    user: userId,
                    role: 'member',
                    joinedAt: new Date()
                });
                group.memberCount += 1;
                message = 'تم الانضمام إلى المجموعة بنجاح';

                // Create notification for group admin
                await Notification.create({
                    recipient: group.admin,
                    sender: userId,
                    type: 'group_join',
                    title: 'عضو جديد',
                    message: `${user.profile.firstName} انضم إلى مجموعتك "${group.name}"`,
                    data: { groupId: group._id, userId }
                });
            } else {
                // Request to join private/secret groups
                group.membershipRequests.push({
                    user: userId,
                    message: req.body.message || '',
                    status: 'pending'
                });
                message = 'تم إرسال طلب الانضمام';

                // Create notification for group admin
                await Notification.create({
                    recipient: group.admin,
                    sender: userId,
                    type: 'group_request',
                    title: 'طلب انضمام جديد',
                    message: `${user.profile.firstName} يريد الانضمام إلى مجموعتك "${group.name}"`,
                    data: { 
                        groupId: group._id, 
                        userId,
                        requestId: group.membershipRequests[group.membershipRequests.length - 1]._id
                    }
                });
            }

            await group.save();

            res.json({
                success: true,
                message
            });

        } catch (error) {
            console.error('Join group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء الانضمام إلى المجموعة'
            });
        }
    }

    // Leave group
    async leaveGroup(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check if member
            const memberIndex = group.members.findIndex(m => m.user.equals(userId));
            if (memberIndex === -1) {
                return res.status(400).json({
                    success: false,
                    error: 'أنت لست عضو في هذه المجموعة'
                });
            }

            // Check if admin
            if (group.admin.equals(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن للمسؤول مغادرة المجموعة، قم بنقل الإدارة أولاً'
                });
            }

            // Remove from members
            group.members.splice(memberIndex, 1);
            group.memberCount -= 1;

            // Remove from moderators if applicable
            group.moderators = group.moderators.filter(m => !m.user.equals(userId));

            await group.save();

            res.json({
                success: true,
                message: 'تم مغادرة المجموعة بنجاح'
            });

        } catch (error) {
            console.error('Leave group error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء مغادرة المجموعة'
            });
        }
    }

    // Get group members
    async getGroupMembers(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { page = 1, limit = 50, role } = req.query;
            const skip = (page - 1) * limit;

            const group = await Group.findById(id)
                .populate({
                    path: 'members.user',
                    select: 'username profile',
                    options: {
                        skip,
                        limit: parseInt(limit)
                    }
                });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Filter by role if specified
            let members = group.members;
            if (role) {
                members = members.filter(m => m.role === role);
            }

            // Add current user's friendship status
            const currentUser = await User.findById(userId);
            const membersWithFriendship = await Promise.all(
                members.map(async (member) => {
                    const isFriend = currentUser.friends.includes(member.user._id);
                    return {
                        ...member.toObject(),
                        isFriend
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    members: membersWithFriendship,
                    pagination: {
                        total: members.length,
                        page: parseInt(page),
                        pages: Math.ceil(members.length / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get group members error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب أعضاء المجموعة'
            });
        }
    }

    // Update member role
    async updateMemberRole(req, res) {
        try {
            const userId = req.userId;
            const { id, memberId } = req.params;
            const { role } = req.body;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لتعديل أدوار الأعضاء'
                });
            }

            // Find member
            const memberIndex = group.members.findIndex(m => m.user.equals(memberId));
            if (memberIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'العضو غير موجود في المجموعة'
                });
            }

            // Check if trying to modify admin
            if (group.admin.equals(memberId)) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن تعديل دور المسؤول'
                });
            }

            // Update role
            group.members[memberIndex].role = role;

            // Update moderators list
            if (role === 'moderator') {
                const isAlreadyModerator = group.moderators.some(m => m.user.equals(memberId));
                if (!isAlreadyModerator) {
                    group.moderators.push({
                        user: memberId,
                        assignedAt: new Date(),
                        permissions: ['manage_posts', 'manage_members']
                    });
                }
            } else {
                group.moderators = group.moderators.filter(m => !m.user.equals(memberId));
            }

            await group.save();

            // Create notification for the member
            const user = await User.findById(userId);
            const memberUser = await User.findById(memberId);

            await Notification.create({
                recipient: memberId,
                sender: userId,
                type: 'group_role_change',
                title: 'تغيير دور في المجموعة',
                message: `${user.profile.firstName} غير دورك في المجموعة "${group.name}" إلى ${role === 'admin' ? 'مسؤول' : role === 'moderator' ? 'مشرف' : 'عضو'}`,
                data: { 
                    groupId: group._id,
                    newRole: role 
                }
            });

            res.json({
                success: true,
                message: `تم تغيير دور العضو إلى ${role === 'admin' ? 'مسؤول' : role === 'moderator' ? 'مشرف' : 'عضو'}`
            });

        } catch (error) {
            console.error('Update member role error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء تغيير دور العضو'
            });
        }
    }

    // Remove member
    async removeMember(req, res) {
        try {
            const userId = req.userId;
            const { id, memberId } = req.params;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لإزالة الأعضاء'
                });
            }

            // Can't remove yourself if admin
            if (memberId === userId && group.admin.equals(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن للمسؤول إزالة نفسه، قم بنقل الإدارة أولاً'
                });
            }

            // Can't remove admin
            if (group.admin.equals(memberId)) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن إزالة مسؤول المجموعة'
                });
            }

            // Find and remove member
            const memberIndex = group.members.findIndex(m => m.user.equals(memberId));
            if (memberIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'العضو غير موجود في المجموعة'
                });
            }

            group.members.splice(memberIndex, 1);
            group.memberCount -= 1;

            // Remove from moderators if applicable
            group.moderators = group.moderators.filter(m => !m.user.equals(memberId));

            await group.save();

            // Create notification for the removed member
            const user = await User.findById(userId);
            const removedUser = await User.findById(memberId);

            await Notification.create({
                recipient: memberId,
                sender: userId,
                type: 'group_remove',
                title: 'إزالة من المجموعة',
                message: `${user.profile.firstName} أزالك من المجموعة "${group.name}"`,
                data: { groupId: group._id }
            });

            res.json({
                success: true,
                message: 'تم إزالة العضو من المجموعة'
            });

        } catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إزالة العضو'
            });
        }
    }

    // Ban member
    async banMember(req, res) {
        try {
            const userId = req.userId;
            const { id, memberId } = req.params;
            const { reason } = req.body;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لحظر الأعضاء'
                });
            }

            // Can't ban yourself
            if (memberId === userId) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكنك حظر نفسك'
                });
            }

            // Can't ban admin
            if (group.admin.equals(memberId)) {
                return res.status(400).json({
                    success: false,
                    error: 'لا يمكن حظر مسؤول المجموعة'
                });
            }

            // Find member
            const memberIndex = group.members.findIndex(m => m.user.equals(memberId));
            if (memberIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'العضو غير موجود في المجموعة'
                });
            }

            // Update member status
            group.members[memberIndex].status = 'banned';

            await group.save();

            // Create notification for the banned member
            const user = await User.findById(userId);
            const bannedUser = await User.findById(memberId);

            await Notification.create({
                recipient: memberId,
                sender: userId,
                type: 'group_ban',
                title: 'حظر من المجموعة',
                message: `${user.profile.firstName} حظرك من المجموعة "${group.name}"${reason ? ` للسبب: ${reason}` : ''}`,
                data: { 
                    groupId: group._id,
                    reason: reason || ''
                }
            });

            res.json({
                success: true,
                message: 'تم حظر العضو من المجموعة'
            });

        } catch (error) {
            console.error('Ban member error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء حظر العضو'
            });
        }
    }

    // Unban member
    async unbanMember(req, res) {
        try {
            const userId = req.userId;
            const { id, memberId } = req.params;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لإلغاء حظر الأعضاء'
                });
            }

            // Find member
            const memberIndex = group.members.findIndex(m => m.user.equals(memberId));
            if (memberIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'العضو غير موجود في المجموعة'
                });
            }

            // Update member status
            group.members[memberIndex].status = 'active';

            await group.save();

            // Create notification for the unbanned member
            const user = await User.findById(userId);
            const unbannedUser = await User.findById(memberId);

            await Notification.create({
                recipient: memberId,
                sender: userId,
                type: 'group_unban',
                title: 'إلغاء حظر من المجموعة',
                message: `${user.profile.firstName} ألغى حظرك من المجموعة "${group.name}"`,
                data: { groupId: group._id }
            });

            res.json({
                success: true,
                message: 'تم إلغاء حظر العضو'
            });

        } catch (error) {
            console.error('Unban member error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء إلغاء حظر العضو'
            });
        }
    }

    // Get membership requests
    async getMembershipRequests(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { status = 'pending' } = req.query;

            const group = await Group.findById(id)
                .populate({
                    path: 'membershipRequests.user',
                    select: 'username profile'
                });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لعرض طلبات الانضمام'
                });
            }

            // Filter requests by status
            const requests = group.membershipRequests.filter(
                req => req.status === status
            );

            res.json({
                success: true,
                data: requests
            });

        } catch (error) {
            console.error('Get membership requests error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب طلبات الانضمام'
            });
        }
    }

    // Respond to membership request
    async respondToMembershipRequest(req, res) {
        try {
            const userId = req.userId;
            const { id, requestId } = req.params;
            const { action } = req.body; // 'approve' or 'reject'

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية للرد على طلبات الانضمام'
                });
            }

            // Find request
            const requestIndex = group.membershipRequests.findIndex(
                req => req._id.toString() === requestId
            );

            if (requestIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'طلب الانضمام غير موجود'
                });
            }

            const request = group.membershipRequests[requestIndex];
            const requester = await User.findById(request.user);

            if (action === 'approve') {
                // Add to members
                group.members.push({
                    user: request.user,
                    role: 'member',
                    joinedAt: new Date()
                });
                group.memberCount += 1;

                request.status = 'approved';
                request.processedAt = new Date();
                request.processedBy = userId;

                // Create notification for requester
                await Notification.create({
                    recipient: request.user,
                    sender: userId,
                    type: 'group_request_accepted',
                    title: 'تم قبول طلب الانضمام',
                    message: `تم قبول طلبك للانضمام إلى المجموعة "${group.name}"`,
                    data: { groupId: group._id }
                });
            } else {
                request.status = 'rejected';
                request.processedAt = new Date();
                request.processedBy = userId;

                // Create notification for requester
                await Notification.create({
                    recipient: request.user,
                    sender: userId,
                    type: 'group_request_rejected',
                    title: 'تم رفض طلب الانضمام',
                    message: `تم رفض طلبك للانضمام إلى المجموعة "${group.name}"`,
                    data: { groupId: group._id }
                });
            }

            await group.save();

            res.json({
                success: true,
                message: `تم ${action === 'approve' ? 'قبول' : 'رفض'} طلب الانضمام`
            });

        } catch (error) {
            console.error('Respond to membership request error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء الرد على طلب الانضمام'
            });
        }
    }

    // Get group posts
    async getGroupPosts(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check membership
            const isMember = group.members.some(m => m.user.equals(userId));
            if (!isMember && group.privacy !== 'public') {
                return res.status(403).json({
                    success: false,
                    error: 'يجب أن تكون عضو في المجموعة لعرض المنشورات'
                });
            }

            const posts = await Post.find({ 
                group: id,
                isStory: false 
            })
            .populate('author', 'username profile')
            .populate('likes.user', 'username profile')
            .populate('tags', 'username profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

            const total = await Post.countDocuments({ 
                group: id,
                isStory: false 
            });

            res.json({
                success: true,
                data: {
                    posts,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get group posts error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب منشورات المجموعة'
            });
        }
    }

    // Search groups
    async searchGroups(req, res) {
        try {
            const userId = req.userId;
            const { q, page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'يجب أن يكون نص البحث على الأقل حرفين'
                });
            }

            const searchRegex = new RegExp(q, 'i');

            const query = {
                $or: [
                    { name: searchRegex },
                    { description: searchRegex },
                    { tags: searchRegex }
                ],
                privacy: { $ne: 'secret' }
            };

            const groups = await Group.find(query)
                .populate('admin', 'username profile')
                .sort({ memberCount: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Group.countDocuments(query);

            // Add membership info
            const user = await User.findById(userId);
            const groupsWithMembership = groups.map(group => {
                const isMember = group.members.some(m => m.user.equals(userId));
                const hasPendingRequest = group.membershipRequests.some(
                    req => req.user.equals(userId) && req.status === 'pending'
                );

                return {
                    ...group.toObject(),
                    isMember,
                    hasPendingRequest,
                    canJoin: group.privacy === 'public' || 
                            (group.privacy === 'private' && !isMember)
                };
            });

            res.json({
                success: true,
                data: {
                    groups: groupsWithMembership,
                    pagination: {
                        total,
                        page: parseInt(page),
                        pages: Math.ceil(total / limit),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Search groups error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء البحث عن المجموعات'
            });
        }
    }

    // Get group analytics
    async getGroupAnalytics(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;

            const group = await Group.findById(id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'المجموعة غير موجودة'
                });
            }

            // Check permissions
            const isAdmin = group.admin.equals(userId);
            const isModerator = group.moderators.some(m => m.user.equals(userId));
            
            if (!isAdmin && !isModerator) {
                return res.status(403).json({
                    success: false,
                    error: 'ليس لديك صلاحية لعرض إحصائيات المجموعة'
                });
            }

            // Get analytics data
            const [
                totalPosts,
                totalMembers,
                newMembersThisWeek,
                activeMembers
            ] = await Promise.all([
                Post.countDocuments({ group: id }),
                group.memberCount,
                User.countDocuments({
                    _id: { $in: group.members.map(m => m.user) },
                    lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }),
                User.countDocuments({
                    _id: { $in: group.members.map(m => m.user) },
                    lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            ]);

            const analytics = {
                totalPosts,
                totalMembers,
                newMembersThisWeek,
                activeMembers,
                engagementRate: ((activeMembers / totalMembers) * 100).toFixed(2),
                growthRate: ((newMembersThisWeek / totalMembers) * 100).toFixed(2)
            };

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            console.error('Get group analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ أثناء جلب إحصائيات المجموعة'
            });
        }
    }
}

module.exports = new GroupController();
