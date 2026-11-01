using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.MongoDb;

namespace MapManager.Api.Tests.Http;

public sealed class MongoDbFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder()
        .WithImage("mongo:8.0")
        .Build();

    public Task InitializeAsync() => _mongo.StartAsync();

    public async Task DisposeAsync() => await _mongo.DisposeAsync();

    public MongoApiFactory CreateFactory() => new(
        _mongo.GetConnectionString(),
        $"mapmanager_test_{Guid.NewGuid():N}");
}
