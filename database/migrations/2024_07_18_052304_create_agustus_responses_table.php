<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('agustus_responses', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('region_id');
            $table->string('pcl')->nullable();
            $table->string('pml')->nullable();
            $table->integer('nurt')->nullable();
            $table->integer('hasil_kunjungan');
            $table->integer('no_art')->nullable();
            $table->string('nama_art')->nullable();
            $table->integer('umur')->nullable();
            $table->integer('r6a')->nullable();
            $table->integer('r8a')->nullable();
            $table->integer('r8b')->nullable();
            $table->integer('r8c')->nullable();
            $table->integer('r8d')->nullable();
            $table->integer('r8e')->nullable();
            $table->integer('r8f')->nullable();
            $table->integer('r10a')->nullable();
            $table->integer('r10b')->nullable();
            $table->integer('r10c')->nullable();
            $table->integer('r11')->nullable();
            $table->string('konfirmasir11')->nullable();
            $table->string('r13a')->nullable();
            $table->string('r13b')->nullable();
            $table->string('r13c')->nullable();
            $table->integer('r14a')->nullable();
            $table->char('kbli', 5)->nullable();
            $table->char('kbji', 5)->nullable();
            $table->integer('r17a')->nullable();
            $table->integer('r17b')->nullable();
            $table->integer('r26a')->nullable();
            $table->integer('r38a')->nullable();
            $table->integer('r38b')->nullable();
            $table->string('konfirmasir38')->nullable();
            $table->integer('r42a')->nullable();
            $table->text('konfirmasi42')->nullable();
            $table->integer('r45a')->nullable();
            $table->integer('r50d')->nullable();
            $table->char('docState', 1)->default('E');
            $table->integer('submit_status')->default(2);
            $table->date('updated_at')->nullable();
            $table->date('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agustus_responses');
    }
};
