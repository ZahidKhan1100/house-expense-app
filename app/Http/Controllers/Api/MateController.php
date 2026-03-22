<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JoinRequest;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MateController extends Controller
{
    // Get all mates (approved + pending)
    public function index(Request $request)
    {
        $user = Auth::user();
        $house = $user->house; // assuming User has house() relation
        $isAdmin = $user->role === 'admin';

        if (!$house) {
            return response()->json([
                'approved' => [],
                'pending' => [],
                'is_admin' => $isAdmin,
            ]);
        }

        // Admin object
        $admin = $house->mates()->where('role', 'admin')->first();
        $adminData = $admin ? [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
        ] : null;

        // Approved mates (excluding admin)
        $approved = $house->mates()
            ->where('role', 'mate')
            ->where('status', 'approved')
            ->get(['id', 'name', 'email'])
            ->toArray();

        // Pending mates
        $pending = $house->joinRequests()
            ->get()
            ->map(function ($req) {
                $user = $req->user; // assuming joinRequest has user relation
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ];
            });

             $houseData = [
        'id' => $house->id,
        'name' => $house->name,
        'house_code' => $house->code, // unique code for QR
    ];

        return response()->json([
            'is_admin' => $isAdmin,
            'admin' => $adminData,
            'approved' => $approved,
            'pending' => $pending,
            'house' => $houseData,
        ]);
    }

    // Approve a mate
    public function approve(Request $request, $id)
    {
        $user = $request->user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $mate = User::findOrFail($id);

        // Assign house + approve
        $mate->house_id = $user->house_id;
        $mate->status = 'approved';
        $mate->role = 'mate';
        $mate->save();

        JoinRequest::where('user_id', $mate->id)
        ->where('house_id', $user->house_id)
        ->delete();

        return response()->json([
            'message' => 'Mate approved',
            'mate' => $mate
        ]);
    }

    // Reject a mate
    public function reject(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $mate = User::findOrFail($id);
        $mate->status = 'rejected';
        $mate->save();

        return response()->json(['message' => 'Mate rejected']);
    }

    // Update mate
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $mate = User::findOrFail($id);
        $mate->name = $request->name ?? $mate->name;
        $mate->save();

        return response()->json(['message' => 'Mate updated', 'mate' => $mate]);
    }

    // Delete mate
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $mate = User::findOrFail($id);
        $mate->status = 'deleted';
        $mate->save();

        return response()->json(['message' => 'Mate deleted']);
    }
}