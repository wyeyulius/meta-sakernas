<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class AgustusResponse extends Model
{
    use HasFactory;

    protected $fillable = ['region_id'];
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
