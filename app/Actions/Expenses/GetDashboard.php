<?php

namespace App\Actions\Expenses;

use App\Models\User;
use Illuminate\Support\Facades\Log;

class GetDashboard
{
    public function handle(User $user): array
    {
        $house = $user->house;

        // If user has no house
        if (!$house) {
            return [
                'total_spent' => 0,
                'currency' => '$',
                'categories' => [],
                'mates' => [],
            ];
        }

        // --- Fetch categories for this house as array ---
        $categories = $house->categories()
            ->get()
            ->mapWithKeys(function ($cat) {
                return [$cat->id => [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'icon' => $cat->icon,
                    'total' => 0, // initialize
                ]];
            })
            ->toArray(); // convert to array for direct modification

        $totalSpent = 0;

        // --- Loop through house expenses (month-based) ---
        $house->expenses()->with('records')->get()->each(function ($expenseMonth) use (&$categories, &$totalSpent) {

            Log::info('Processing expense month: ' . $expenseMonth->id . ' | Month: ' . $expenseMonth->month);

            foreach ($expenseMonth->records as $record) {
                Log::info('Record ID: ' . $record->id . ' | Category: ' . $record->category_id . ' | Amount: ' . $record->amount);

                $totalSpent += $record->amount;

                // Safely add to category total if category exists
                if ($record->category_id && isset($categories[$record->category_id])) {
                    $categories[$record->category_id]['total'] += $record->amount;
                }
            }
        });

        // --- Prepare mates list ---
        $mates = $house->mates()
            ->get()
            ->map(function ($mate) {
                return [
                    'id' => $mate->id,
                    'name' => $mate->name,
                    'role' => $mate->role,
                ];
            });

        Log::info('Dashboard summary: total_spent=' . $totalSpent . ' | Categories=' . json_encode($categories));

        return [
            'total_spent' => round($totalSpent, 2),
            'currency' => $house->currency ?? '$',
            'categories' => array_values($categories), // reindex array
            'mates' => $mates,
        ];
    }
}