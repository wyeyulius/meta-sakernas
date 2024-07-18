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
        Schema::create('regions', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('provinsi')->nullable();
            $table->string('nama_provinsi', 25)->nullable();
            $table->string('kabupaten', 2)->nullable();
            $table->string('nama_kabupaten', 26)->nullable();
            $table->string('kecamatan', 3)->nullable();
            $table->string('nama_kecamatan', 31)->nullable();
            $table->string('desa', 3)->nullable();
            $table->string('nama_desa', 46)->nullable();
            $table->integer('klasifikasi')->nullable();
            $table->string('nbs', 4)->nullable();
            $table->integer('nks')->nullable();
            $table->string('sak', 1)->nullable();
            $table->integer('jumlah_keluarga')->nullable();
            $table->integer('jml_sampel')->default(10);
            $table->string('sumber_data', 11)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('regions');
    }
};
